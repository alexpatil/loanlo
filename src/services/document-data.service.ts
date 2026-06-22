import "server-only";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, maskAadhaar, round2 } from "@/lib/utils";
import {
  LOAN_TYPE_LABELS,
  INTEREST_PERIOD_LABELS,
  INTEREST_METHOD_LABELS,
  CASH_TYPE_LABELS,
  CASH_TYPE_SIGN,
  type LoanTypeKey,
  type InterestPeriodKey,
  type InterestMethodKey,
  type CashTransactionTypeKey,
} from "@/lib/constants";
import { computeFlexibleForLoan, flexibleTermsOf } from "./flexible-loan.service";
import { getCashBookEntries, getOpeningBalance } from "./cash.service";
import type {
  AgreementData,
  StatementData,
  StatementLineDTO,
  ReceiptData,
  ReportData,
  CashBookData,
} from "./pdf/documents";

const inr = (n: number) =>
  "INR " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n ?? 0);

function rateLabel(loan: {
  loanType: string;
  interestRate: number;
  interestPeriod: string;
  interestMethod: string;
}) {
  if (loan.loanType === "FLEXIBLE_LOAN") {
    return `${loan.interestRate}% ${INTEREST_METHOD_LABELS[loan.interestMethod as InterestMethodKey]} / ${INTEREST_PERIOD_LABELS[loan.interestPeriod as InterestPeriodKey]}`;
  }
  return `${loan.interestRate}% p.a.`;
}

export async function buildAgreementData(loanId: string, scopeAgentId?: string): Promise<AgreementData | null> {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, deletedAt: { isSet: false }, ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}) },
    include: { customer: true },
  });
  if (!loan) return null;
  const c = loan.customer;
  const address = [c.addressLine1, c.city, c.state, c.pincode].filter(Boolean).join(", ");

  return {
    loanNumber: loan.loanNumber,
    date: formatDate(loan.createdAt),
    loanTypeLabel: LOAN_TYPE_LABELS[loan.loanType as LoanTypeKey],
    customer: {
      name: `${c.firstName} ${c.lastName}`,
      code: c.customerCode,
      phone: c.phone,
      address,
      aadhaar: maskAadhaar(c.aadhaarNumber),
      pan: c.panNumber ?? "—",
    },
    terms: {
      principal: loan.principalAmount,
      rateLabel: rateLabel(loan),
      tenureMonths: loan.tenureMonths,
      emiAmount: loan.emiAmount,
      processingFee: loan.processingFee,
      totalInterest: loan.totalInterest,
      totalPayable: loan.totalPayable,
      gracePeriodDays: loan.gracePeriodDays,
      disbursementDate: formatDate(loan.disbursementDate),
      maturityDate: formatDate(loan.maturityDate),
    },
  };
}

export async function buildStatementData(loanId: string, scopeAgentId?: string): Promise<StatementData | null> {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, deletedAt: { isSet: false }, ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}) },
    include: { customer: { select: { firstName: true, lastName: true } } },
  });
  if (!loan) return null;

  const customerName = `${loan.customer.firstName} ${loan.customer.lastName}`;
  const loanTypeLabel = LOAN_TYPE_LABELS[loan.loanType as LoanTypeKey];
  const lines: StatementLineDTO[] = [];

  // Migrated loans: ledger reconstructed from the opening balance + historical
  // collections, reconciled to the authoritative entered outstanding.
  if (loan.isMigrated) {
    const migPayments = await prisma.payment.findMany({
      where: { loanId: loan.id, deletedAt: { isSet: false } },
      orderBy: { paymentDate: "asc" },
    });
    let migBalance = loan.principalAmount;
    lines.push({
      date: formatDate(loan.disbursementDate ?? loan.createdAt),
      description: "Migrated opening balance",
      debit: inr(loan.principalAmount),
      credit: "",
      balance: inr(migBalance),
    });
    let migPaid = 0;
    for (const p of migPayments) {
      migBalance = Math.max(0, migBalance - p.amount);
      migPaid += p.amount;
      lines.push({
        date: formatDate(p.paymentDate),
        description: p.isMigrated ? "Historical collection (migrated)" : "Payment",
        debit: "",
        credit: inr(p.amount),
        balance: inr(migBalance),
      });
    }
    // Reconcile the computed balance to the entered outstanding if they differ.
    if (Math.round(migBalance) !== Math.round(loan.outstandingPrincipal)) {
      lines.push({
        date: formatDate(loan.migratedAt ?? new Date()),
        description: "Outstanding as per physical register",
        debit: "",
        credit: "",
        balance: inr(loan.outstandingPrincipal),
      });
    }
    return {
      loanNumber: loan.loanNumber,
      customerName,
      generatedAt: formatDate(new Date()),
      loanTypeLabel: `${loanTypeLabel} · Migrated`,
      summary: {
        principal: loan.principalAmount,
        charged: loan.totalInterest,
        paid: migPaid,
        outstanding: loan.outstandingPrincipal,
      },
      lines,
    };
  }

  if (loan.loanType === "FLEXIBLE_LOAN" && loan.disbursementDate) {
    const state = await computeFlexibleForLoan(loan);
    for (const ln of state.statement) {
      lines.push({
        date: formatDate(ln.date),
        description: ln.description,
        debit: ln.type === "PAYMENT" ? "" : inr(ln.type === "DISBURSEMENT" ? loan.principalAmount : ln.interest),
        credit: ln.type === "PAYMENT" ? inr(ln.payment) : "",
        balance: inr(ln.balance),
      });
    }
    return {
      loanNumber: loan.loanNumber,
      customerName,
      generatedAt: formatDate(new Date()),
      loanTypeLabel,
      summary: {
        principal: loan.principalAmount,
        charged: state.totalInterestAccrued,
        paid: state.totalPaid,
        outstanding: state.totalOutstanding,
      },
      lines,
    };
  }

  // Installment loans: amortization-style statement from payments.
  const payments = await prisma.payment.findMany({
    where: { loanId: loan.id, deletedAt: { isSet: false } },
    orderBy: { paymentDate: "asc" },
    include: { collectedBy: { select: { name: true } } },
  });

  let balance = loan.totalPayable;
  lines.push({
    date: formatDate(loan.disbursementDate ?? loan.createdAt),
    description: "Loan disbursed (total payable)",
    debit: inr(loan.totalPayable),
    credit: "",
    balance: inr(balance),
  });
  let paid = 0;
  for (const p of payments) {
    balance = Math.max(0, balance - p.amount);
    paid += p.amount;
    lines.push({
      date: formatDate(p.paymentDate),
      description: `Payment (${p.paymentMethod.toLowerCase()})`,
      debit: "",
      credit: inr(p.amount),
      balance: inr(balance),
    });
  }

  return {
    loanNumber: loan.loanNumber,
    customerName,
    generatedAt: formatDate(new Date()),
    loanTypeLabel,
    summary: {
      principal: loan.principalAmount,
      charged: loan.totalInterest,
      paid,
      outstanding: balance,
    },
    lines,
  };
}

export async function buildReceiptData(paymentId: string, scopeAgentId?: string): Promise<ReceiptData | null> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, deletedAt: { isSet: false }, ...(scopeAgentId ? { loan: { assignedAgentId: scopeAgentId } } : {}) },
    include: {
      loan: { select: { loanNumber: true, outstandingPrincipal: true } },
      customer: { select: { firstName: true, lastName: true } },
      collectedBy: { select: { name: true } },
    },
  });
  if (!payment) return null;

  return {
    receiptNo: `RCPT-${payment.id.slice(-8).toUpperCase()}`,
    date: formatDate(payment.paymentDate),
    customerName: `${payment.customer.firstName} ${payment.customer.lastName}`,
    loanNumber: payment.loan.loanNumber,
    amount: payment.amount,
    method: payment.paymentMethod.replace(/_/g, " "),
    principal: payment.principalAmount,
    interest: payment.interestAmount,
    penalty: payment.penaltyAmount,
    outstandingAfter: payment.loan.outstandingPrincipal,
    collectedBy: payment.collectedBy?.name ?? "—",
  };
}

async function buildReport(
  title: string,
  periodLabel: string,
  from: Date,
  to: Date,
  scopeAgentId?: string,
): Promise<ReportData> {
  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: { isSet: false },
      paymentDate: { gte: from, lte: to },
      ...(scopeAgentId ? { loan: { assignedAgentId: scopeAgentId } } : {}),
    },
    orderBy: { paymentDate: "asc" },
    include: {
      loan: { select: { loanNumber: true } },
      customer: { select: { firstName: true, lastName: true } },
      collectedBy: { select: { name: true } },
    },
  });

  const totals = payments.reduce(
    (acc, p) => ({
      count: acc.count + 1,
      amount: acc.amount + p.amount,
      principal: acc.principal + p.principalAmount,
      interest: acc.interest + p.interestAmount,
      penalty: acc.penalty + p.penaltyAmount,
    }),
    { count: 0, amount: 0, principal: 0, interest: 0, penalty: 0 },
  );

  return {
    title,
    periodLabel,
    generatedAt: formatDate(new Date()),
    rows: payments.map((p) => ({
      date: formatDate(p.paymentDate),
      loanNumber: p.loan.loanNumber,
      customer: `${p.customer.firstName} ${p.customer.lastName}`,
      amount: formatCurrency(p.amount),
      method: p.paymentMethod.replace(/_/g, " "),
      collectedBy: p.collectedBy?.name ?? "—",
    })),
    totals,
  };
}

export function buildDailyReport(date: Date, scopeAgentId?: string) {
  return buildReport(
    "Daily Collection Report",
    format(date, "dd MMM yyyy"),
    startOfDay(date),
    endOfDay(date),
    scopeAgentId,
  );
}

export function buildMonthlyReport(date: Date, scopeAgentId?: string) {
  return buildReport(
    "Monthly Collection Report",
    format(date, "MMMM yyyy"),
    startOfMonth(date),
    endOfMonth(date),
    scopeAgentId,
  );
}

// ─── Cash book PDFs ──────────────────────────────────────────────────────────

async function buildCashBook(opts: {
  title: string;
  periodLabel: string;
  from?: Date;
  to?: Date;
}): Promise<CashBookData> {
  const [entries, openingBalance] = await Promise.all([
    getCashBookEntries(opts.from, opts.to),
    opts.from ? getOpeningBalance(opts.from) : Promise.resolve(0),
  ]);

  let balance = openingBalance;
  let inflow = 0;
  let outflow = 0;
  const rows = entries.map((e) => {
    const sign = CASH_TYPE_SIGN[e.type as CashTransactionTypeKey];
    balance = round2(balance + sign * e.amount);
    if (sign === 1) inflow = round2(inflow + e.amount);
    else outflow = round2(outflow + e.amount);
    return {
      date: formatDate(e.transactionDate),
      type: CASH_TYPE_LABELS[e.type as CashTransactionTypeKey],
      note: e.note ?? "—",
      inAmount: sign === 1 ? inr(e.amount) : "",
      outAmount: sign === -1 ? inr(e.amount) : "",
      balance: inr(balance),
    };
  });

  return {
    title: opts.title,
    periodLabel: opts.periodLabel,
    generatedAt: formatDate(new Date()),
    openingBalance,
    closingBalance: balance,
    rows,
    totals: { inflow, outflow },
  };
}

export function buildCashBookReport(from?: Date, to?: Date) {
  const label =
    from || to
      ? `${from ? formatDate(from) : "Start"} – ${to ? formatDate(to) : "Today"}`
      : "All time";
  return buildCashBook({ title: "Cash Book Report", periodLabel: label, from, to });
}

export function buildDailyCashReport(date: Date) {
  return buildCashBook({
    title: "Daily Cash Report",
    periodLabel: format(date, "dd MMM yyyy"),
    from: startOfDay(date),
    to: endOfDay(date),
  });
}

export function buildMonthlyCashReport(date: Date) {
  return buildCashBook({
    title: "Monthly Cash Report",
    periodLabel: format(date, "MMMM yyyy"),
    from: startOfMonth(date),
    to: endOfMonth(date),
  });
}
