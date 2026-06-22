import "server-only";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod, Prisma, EmiSchedule } from "@prisma/client";
import { round2 } from "@/lib/utils";
import { calculatePenalty, recalcReducingInstallments, type LoanMethod } from "@/lib/finance";
import { computeFlexible } from "@/lib/interest-engine";
import { flexibleTermsOf } from "./flexible-loan.service";
import { recordCashTransaction } from "./cash.service";
import { DEFAULT_PENALTY_RATE } from "@/lib/constants";

interface RecordPaymentInput {
  loanId: string;
  emiScheduleId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  reference?: string;
  notes?: string;
  collectedById: string;
}

interface Allocation {
  principal: number;
  interest: number;
  penalty: number;
}

/**
 * Allocate `amount` across the given installments using the
 * penalty → interest → principal waterfall, honouring the loan's grace period.
 * Mutates each installment in the DB; returns the per-bucket allocation and the
 * unallocated remainder.
 */
async function applyWaterfall(
  tx: Prisma.TransactionClient,
  emis: EmiSchedule[],
  amount: number,
  paymentDate: Date,
  gracePeriodDays: number,
): Promise<{ alloc: Allocation; remaining: number }> {
  let remaining = round2(amount);
  const alloc: Allocation = { principal: 0, interest: 0, penalty: 0 };

  for (const emi of emis) {
    if (remaining <= 0) break;

    const penaltyDue = Math.max(
      0,
      calculatePenalty(
        emi.emiAmount,
        emi.dueDate,
        paymentDate,
        gracePeriodDays,
        DEFAULT_PENALTY_RATE,
      ) - emi.penaltyAmount,
    );

    const totalDue = round2(emi.emiAmount + emi.penaltyAmount + penaltyDue - emi.paidAmount);
    if (totalDue <= 0) continue;

    const pay = round2(Math.min(remaining, totalDue));

    let leftover = pay;
    const penaltyPay = Math.min(leftover, round2(emi.penaltyAmount + penaltyDue));
    leftover = round2(leftover - penaltyPay);
    const interestShare = Math.min(leftover, emi.interestComponent);
    leftover = round2(leftover - interestShare);
    const principalShare = leftover;

    alloc.penalty = round2(alloc.penalty + penaltyPay);
    alloc.interest = round2(alloc.interest + interestShare);
    alloc.principal = round2(alloc.principal + principalShare);

    const newPaid = round2(emi.paidAmount + pay);
    const newPenalty = round2(emi.penaltyAmount + penaltyDue);
    const fullyPaid = newPaid >= round2(emi.emiAmount + newPenalty);

    await tx.emiSchedule.update({
      where: { id: emi.id },
      data: {
        paidAmount: newPaid,
        penaltyAmount: newPenalty,
        status: fullyPaid ? "PAID" : "PARTIAL",
        paidDate: fullyPaid ? paymentDate : emi.paidDate,
      },
    });

    remaining = round2(remaining - pay);
  }

  return { alloc, remaining };
}

/**
 * Flexible loan collection: interest accrued up to the payment date is computed
 * dynamically from history, then the payment is applied interest-first. The
 * loan's live outstanding is re-derived and persisted.
 */
async function recordFlexiblePayment(
  tx: Prisma.TransactionClient,
  loan: import("@prisma/client").Loan,
  input: RecordPaymentInput,
) {
  const priorPayments = await tx.payment.findMany({
    where: { loanId: loan.id, deletedAt: { isSet: false } },
    select: { amount: true, paymentDate: true },
  });

  const terms = flexibleTermsOf(loan);
  const before = computeFlexible(
    terms,
    priorPayments.map((p) => ({ date: p.paymentDate, amount: p.amount })),
    input.paymentDate,
  );

  const interestPay = round2(Math.min(input.amount, before.interestOutstanding));
  const principalPay = round2(Math.min(input.amount - interestPay, before.principalOutstanding));

  const payment = await tx.payment.create({
    data: {
      loanId: loan.id,
      customerId: loan.customerId,
      amount: round2(input.amount),
      principalAmount: principalPay,
      interestAmount: interestPay,
      penaltyAmount: 0,
      paymentMethod: input.paymentMethod,
      paymentDate: input.paymentDate,
      reference: input.reference,
      notes: input.notes,
      collectedById: input.collectedById,
    },
  });

  await recordCashTransaction(
    {
      type: "COLLECTION_RECEIVED",
      amount: input.amount,
      note: `Collection on ${loan.loanNumber}`,
      loanId: loan.id,
      paymentId: payment.id,
      transactionDate: input.paymentDate,
      createdById: input.collectedById,
    },
    tx,
  );

  const after = computeFlexible(
    terms,
    [
      ...priorPayments.map((p) => ({ date: p.paymentDate, amount: p.amount })),
      { date: input.paymentDate, amount: input.amount },
    ],
    new Date(),
  );

  await tx.loan.update({
    where: { id: loan.id },
    data: {
      outstandingPrincipal: after.principalOutstanding,
      lastAccrualDate: after.asOf,
      ...(after.totalOutstanding <= 0 ? { status: "CLOSED" as const } : {}),
    },
  });

  return payment;
}

/**
 * Record a collection and allocate it across the loan's installments.
 *
 * - EMI / FLAT_INTEREST: waterfall across all outstanding installments.
 * - REDUCING_BALANCE: waterfall across currently-due installments only; any
 *   surplus prepays principal and the remaining future installments are
 *   re-amortized on the lower balance (future interest recalculated).
 *
 * Tracks `outstandingPrincipal`, closes the loan when fully repaid, and runs in
 * a single transaction.
 */
export async function recordPayment(input: RecordPaymentInput) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({ where: { id: input.loanId } });
    if (!loan) throw new Error("Loan not found");

    if (loan.loanType === "FLEXIBLE_LOAN") {
      return recordFlexiblePayment(tx, loan, input);
    }

    const method = loan.loanType as LoanMethod;
    const isReducing = method === "REDUCING_BALANCE";

    // Pick the installments the waterfall applies to.
    const targetEmis = await tx.emiSchedule.findMany({
      where: {
        loanId: input.loanId,
        ...(input.emiScheduleId
          ? { id: input.emiScheduleId }
          : isReducing
            ? { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] }, dueDate: { lte: input.paymentDate } }
            : { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } }),
      },
      orderBy: { installmentNumber: "asc" },
    });

    const { alloc, remaining } = await applyWaterfall(
      tx,
      targetEmis,
      input.amount,
      input.paymentDate,
      loan.gracePeriodDays,
    );

    // For reducing balance, surplus beyond due installments prepays principal.
    let prepayPrincipal = 0;
    if (isReducing && remaining > 0) {
      prepayPrincipal = round2(Math.max(0, Math.min(remaining, loan.outstandingPrincipal - alloc.principal)));
      alloc.principal = round2(alloc.principal + prepayPrincipal);
    }

    const newOutstanding = round2(Math.max(0, loan.outstandingPrincipal - alloc.principal));

    // Reducing balance: re-amortize the future installments on the new balance.
    if (isReducing) {
      const future = await tx.emiSchedule.findMany({
        where: {
          loanId: loan.id,
          status: { not: "PAID" },
          dueDate: { gt: input.paymentDate },
        },
        orderBy: { installmentNumber: "asc" },
      });

      if (newOutstanding <= 0) {
        // Fully repaid early — settle every remaining installment.
        await tx.emiSchedule.updateMany({
          where: { loanId: loan.id, status: { not: "PAID" } },
          data: { status: "PAID", paidDate: input.paymentDate },
        });
      } else if (future.length > 0) {
        const recalculated = recalcReducingInstallments(
          newOutstanding,
          loan.interestRate,
          future.map((f) => ({ installmentNumber: f.installmentNumber, dueDate: f.dueDate })),
        );
        for (const r of recalculated) {
          const original = future.find((f) => f.installmentNumber === r.installmentNumber)!;
          await tx.emiSchedule.update({
            where: { id: original.id },
            data: {
              emiAmount: r.emiAmount,
              principalComponent: r.principalComponent,
              interestComponent: r.interestComponent,
              remainingBalance: r.remainingBalance,
            },
          });
        }
      }
    }

    await tx.loan.update({
      where: { id: loan.id },
      data: { outstandingPrincipal: newOutstanding },
    });

    const payment = await tx.payment.create({
      data: {
        loanId: loan.id,
        customerId: loan.customerId,
        emiScheduleId: input.emiScheduleId,
        amount: round2(input.amount),
        principalAmount: alloc.principal,
        interestAmount: alloc.interest,
        penaltyAmount: alloc.penalty,
        paymentMethod: input.paymentMethod,
        paymentDate: input.paymentDate,
        reference: input.reference,
        notes: input.notes,
        collectedById: input.collectedById,
      },
    });

    await recordCashTransaction(
      {
        type: "COLLECTION_RECEIVED",
        amount: input.amount,
        note: `Collection on ${loan.loanNumber}`,
        loanId: loan.id,
        paymentId: payment.id,
        transactionDate: input.paymentDate,
        createdById: input.collectedById,
      },
      tx,
    );

    // Close the loan once every installment is settled (or balance hits zero).
    const unpaid = await tx.emiSchedule.count({
      where: { loanId: loan.id, status: { not: "PAID" } },
    });
    if (unpaid === 0 || newOutstanding <= 0) {
      await tx.loan.update({ where: { id: loan.id }, data: { status: "CLOSED" } });
    } else if (loan.status === "OVERDUE") {
      const stillOverdue = await tx.emiSchedule.count({
        where: { loanId: loan.id, status: "OVERDUE" },
      });
      if (stillOverdue === 0) {
        await tx.loan.update({ where: { id: loan.id }, data: { status: "ACTIVE" } });
      }
    }

    return payment;
  });
}

interface ListPaymentsParams {
  from?: Date;
  to?: Date;
  collectedById?: string;
  loanId?: string;
  page?: number;
  pageSize?: number;
}

export async function listPayments(params: ListPaymentsParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? 20);

  const where: Prisma.PaymentWhereInput = {
    deletedAt: { isSet: false },
    ...(params.loanId ? { loanId: params.loanId } : {}),
    ...(params.collectedById ? { collectedById: params.collectedById } : {}),
    ...(params.from || params.to
      ? { paymentDate: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } }
      : {}),
  };

  const [items, total, agg] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        loan: { select: { loanNumber: true } },
        customer: { select: { firstName: true, lastName: true, customerCode: true } },
        collectedBy: { select: { name: true } },
      },
      orderBy: { paymentDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where, _sum: { amount: true } }),
  ]);

  return {
    items,
    total,
    totalAmount: agg._sum.amount ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getUpcomingEmis(scopeAgentId?: string, limit = 20) {
  return prisma.emiSchedule.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      loan: {
        deletedAt: { isSet: false },
        status: { in: ["ACTIVE", "OVERDUE"] },
        ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}),
      },
    },
    include: {
      loan: {
        select: {
          loanNumber: true,
          customer: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  });
}
