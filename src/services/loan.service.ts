import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, LoanStatus } from "@prisma/client";
import type { PaginatedResult, LoanWithRelations } from "@/types";
import {
  calculateLoan,
  generateSchedule,
  calculateMaturityDate,
  isPastGrace,
  type LoanMethod,
} from "@/lib/finance";
import {
  projectFlexibleAtMaturity,
  projectNonEmi,
  type InterestMethod,
  type InterestPeriod,
  type DurationUnit,
} from "@/lib/interest-engine";
import type { RepaymentMode, LoanType, CalculationMethod } from "@prisma/client";
import { ActionError } from "@/lib/action-utils";
import type { EditLoanInput } from "@/validations/loan.schema";
import { recordCashTransaction } from "./cash.service";

interface ListLoansParams {
  search?: string;
  status?: string;
  loanType?: string;
  customerId?: string;
  isMigrated?: boolean;
  page?: number;
  pageSize?: number;
  scopeAgentId?: string;
}

const customerSelect = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    customerCode: true,
    phone: true,
  },
};

export async function listLoans(
  params: ListLoansParams = {},
): Promise<PaginatedResult<LoanWithRelations>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? 10);

  const where: Prisma.LoanWhereInput = {
    deletedAt: { isSet: false },
    ...(params.scopeAgentId ? { assignedAgentId: params.scopeAgentId } : {}),
    ...(params.status ? { status: params.status as LoanStatus } : {}),
    ...(params.loanType ? { loanType: params.loanType as never } : {}),
    ...(params.isMigrated !== undefined ? { isMigrated: params.isMigrated } : {}),
    ...(params.customerId ? { customerId: params.customerId } : {}),
    ...(params.search
      ? {
          OR: [
            { loanNumber: { contains: params.search, mode: "insensitive" } },
            {
              customer: {
                is: {
                  OR: [
                    { firstName: { contains: params.search, mode: "insensitive" } },
                    { lastName: { contains: params.search, mode: "insensitive" } },
                    { customerCode: { contains: params.search, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.loan.findMany({
      where,
      include: {
        customer: customerSelect,
        assignedAgent: { select: { id: true, name: true } },
        _count: { select: { emiSchedules: true, payments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.loan.count({ where }),
  ]);

  return {
    items: items as LoanWithRelations[],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getLoanById(id: string, scopeAgentId?: string) {
  return prisma.loan.findFirst({
    where: { id, deletedAt: { isSet: false }, ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}) },
    include: {
      customer: true,
      emiSchedules: { orderBy: { installmentNumber: "asc" } },
      payments: {
        where: { deletedAt: { isSet: false } },
        orderBy: { paymentDate: "desc" },
        include: { collectedBy: { select: { id: true, name: true } } },
      },
      assignedAgent: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });
}

interface CreateLoanData {
  customerId: string;
  loanNumber: string;
  loanKind: "EMI" | "NON_EMI";
  principalAmount: number;
  interestRate: number;
  processingFee: number;
  // EMI
  tenureMonths?: number;
  // Non-EMI
  calculationMethod?: "FLAT" | "REDUCING" | "COMPOUND";
  interestFrequency?: InterestPeriod;
  durationValue?: number;
  durationUnit?: DurationUnit;
  // Shared
  repaymentMode: RepaymentMode;
  expectedPaymentDate?: Date;
  gracePeriodDays: number;
  purpose?: string;
  assignedAgentId?: string;
  createdById: string;
}

export async function createLoan(data: CreateLoanData) {
  let emiAmount = 0;
  let totalInterest: number;
  let totalPayable: number;

  // Storage shape (maps the simplified UI model onto the persisted fields).
  let loanType: LoanType;
  let interestPeriod: InterestPeriod;
  let interestMethod: InterestMethod;
  let calculationMethod: CalculationMethod | null = null;
  let durationValue: number | null = null;
  let durationUnit: DurationUnit | null = null;
  let tenureMonths: number;

  if (data.loanKind === "EMI") {
    loanType = "EMI";
    interestPeriod = "MONTHLY";
    interestMethod = "SIMPLE";
    tenureMonths = data.tenureMonths ?? 1;
    const calc = calculateLoan(
      {
        principal: data.principalAmount,
        annualInterestRate: data.interestRate,
        tenureMonths,
        processingFee: data.processingFee,
      },
      "EMI",
    );
    emiAmount = calc.emiAmount;
    totalInterest = calc.totalInterest;
    totalPayable = calc.totalPayable;
  } else {
    // Non-EMI → time-based accrual (stored as FLEXIBLE_LOAN).
    loanType = "FLEXIBLE_LOAN";
    calculationMethod = data.calculationMethod ?? "REDUCING";
    interestPeriod = data.interestFrequency ?? "MONTHLY";
    interestMethod = calculationMethod === "COMPOUND" ? "COMPOUND" : "SIMPLE";
    durationValue = data.durationValue ?? 1;
    durationUnit = data.durationUnit ?? "MONTHS";
    const proj = projectNonEmi({
      principal: data.principalAmount,
      ratePerPeriod: data.interestRate,
      calc: calculationMethod,
      frequency: interestPeriod,
      durationValue,
      durationUnit,
    });
    totalInterest = proj.totalInterest;
    totalPayable = proj.totalPayable;
    // Keep a months-equivalent tenure for maturity/widgets.
    tenureMonths = Math.max(1, Math.ceil(proj.durationDays / 30));
  }

  // Default the loan's agent to the customer's assigned agent (the agent chosen
  // when the customer was created); fall back to the creator only if the
  // customer has none.
  const assignedAgentId = await resolveLoanAgentId(
    data.assignedAgentId,
    data.customerId,
    data.createdById,
  );

  return prisma.loan.create({
    data: {
      loanNumber: data.loanNumber,
      loanType,
      interestPeriod,
      interestMethod,
      calculationMethod,
      durationValue,
      durationUnit,
      repaymentMode: data.repaymentMode,
      // FIXED_DATE captures the user's date up front; others derive it at disbursement.
      expectedPaymentDate: data.repaymentMode === "FIXED_DATE" ? data.expectedPaymentDate : null,
      gracePeriodDays: data.gracePeriodDays,
      principalAmount: data.principalAmount,
      interestRate: data.interestRate,
      processingFee: data.processingFee,
      tenureMonths,
      purpose: data.purpose,
      emiAmount,
      totalPayable,
      totalInterest,
      outstandingPrincipal: data.principalAmount,
      status: "PENDING",
      customer: { connect: { id: data.customerId } },
      createdBy: { connect: { id: data.createdById } },
      assignedAgent: { connect: { id: assignedAgentId } },
    },
    include: { customer: customerSelect },
  });
}

/**
 * Resolve which agent a loan should be assigned to: an explicit choice wins,
 * otherwise inherit the customer's assigned agent, otherwise the creator.
 */
export async function resolveLoanAgentId(
  explicitAgentId: string | undefined,
  customerId: string,
  fallbackUserId: string,
): Promise<string> {
  if (explicitAgentId) return explicitAgentId;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { assignedAgentId: true },
  });
  return customer?.assignedAgentId ?? fallbackUserId;
}

/**
 * Resolve the expected payment / commitment date for a loan at disbursement,
 * honouring its repayment mode:
 * - DURATION_BASED → derived from tenure (maturity)
 * - FIXED_DATE     → the date already chosen at creation
 * - OPEN_ENDED     → none
 */
export function resolveExpectedPaymentDate(
  repaymentMode: RepaymentMode,
  existing: Date | null,
  maturityDate: Date,
): Date | null {
  if (repaymentMode === "OPEN_ENDED") return null;
  if (repaymentMode === "FIXED_DATE") return existing;
  return maturityDate;
}

/**
 * Transition a loan's status. Moving to ACTIVE disburses the loan: it stamps
 * the disbursement/maturity dates and generates the full EMI schedule in one
 * transaction. APPROVED records the approver.
 */
export async function updateLoanStatus(params: {
  id: string;
  status: LoanStatus;
  approvedById: string;
  disbursementDate?: Date;
}) {
  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    include: { _count: { select: { emiSchedules: true } } },
  });
  if (!loan) throw new Error("Loan not found");

  // Flexible loans accrue dynamically — no EMI schedule is generated.
  if (params.status === "ACTIVE" && loan.loanType === "FLEXIBLE_LOAN") {
    const disbursementDate = params.disbursementDate ?? new Date();
    const maturityDate = calculateMaturityDate(disbursementDate, loan.tenureMonths);
    return prisma.$transaction(async (tx) => {
      const updated = await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: "ACTIVE",
          disbursementDate,
          maturityDate,
          expectedPaymentDate: resolveExpectedPaymentDate(
            loan.repaymentMode,
            loan.expectedPaymentDate,
            maturityDate,
          ),
          outstandingPrincipal: loan.principalAmount,
          lastAccrualDate: disbursementDate,
        },
      });
      // Migrated (historical) loans never represent a real disbursement, so they
      // must not create a cash outflow even if re-activated.
      if (!loan.isMigrated) {
        await recordCashTransaction(
          {
            type: "LOAN_DISBURSEMENT",
            amount: loan.principalAmount,
            note: `Disbursed ${loan.loanNumber}`,
            loanId: loan.id,
            transactionDate: disbursementDate,
            createdById: params.approvedById,
          },
          tx,
        );
      }
      return updated;
    });
  }

  if (params.status === "ACTIVE" && loan._count.emiSchedules === 0) {
    const disbursementDate = params.disbursementDate ?? new Date();
    const maturityDate = calculateMaturityDate(disbursementDate, loan.tenureMonths);
    const schedule = generateSchedule(
      {
        principal: loan.principalAmount,
        annualInterestRate: loan.interestRate,
        tenureMonths: loan.tenureMonths,
      },
      loan.loanType as LoanMethod,
      disbursementDate,
    );

    return prisma.$transaction(async (tx) => {
      await tx.emiSchedule.createMany({
        data: schedule.map((s) => ({
          loanId: loan.id,
          installmentNumber: s.installmentNumber,
          dueDate: s.dueDate,
          emiAmount: s.emiAmount,
          principalComponent: s.principalComponent,
          interestComponent: s.interestComponent,
          remainingBalance: s.remainingBalance,
        })),
      });
      const updated = await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: "ACTIVE",
          disbursementDate,
          maturityDate,
          expectedPaymentDate: resolveExpectedPaymentDate(
            loan.repaymentMode,
            loan.expectedPaymentDate,
            maturityDate,
          ),
          outstandingPrincipal: loan.principalAmount,
        },
      });
      // Migrated (historical) loans never represent a real disbursement, so they
      // must not create a cash outflow even if re-activated.
      if (!loan.isMigrated) {
        await recordCashTransaction(
          {
            type: "LOAN_DISBURSEMENT",
            amount: loan.principalAmount,
            note: `Disbursed ${loan.loanNumber}`,
            loanId: loan.id,
            transactionDate: disbursementDate,
            createdById: params.approvedById,
          },
          tx,
        );
      }
      return updated;
    });
  }

  return prisma.loan.update({
    where: { id: params.id },
    data: {
      status: params.status,
      ...(params.status === "APPROVED" ? { approvedById: params.approvedById } : {}),
    },
  });
}

/**
 * Admin loan correction (fixes agent data-entry mistakes).
 *
 * - Non-financial fields (purpose, agent, grace, repayment mode, dates) can be
 *   changed at any time.
 * - Financial terms (principal, rate, tenure, fee, type, period/method) can only
 *   change while NO payments have been collected. When they change on a
 *   disbursed loan, the EMI schedule is regenerated and outstanding reset.
 */
export async function editLoan(data: EditLoanInput) {
  const loan = await prisma.loan.findUnique({ where: { id: data.id } });
  if (!loan || loan.deletedAt) throw new ActionError("Loan not found.");

  const [paymentCount, scheduleCount] = await Promise.all([
    prisma.payment.count({ where: { loanId: loan.id, deletedAt: { isSet: false } } }),
    prisma.emiSchedule.count({ where: { loanId: loan.id } }),
  ]);

  const sameDate = (a?: Date | null, b?: Date | null) =>
    (!a && !b) || (!!a && !!b && a.getTime() === b.getTime());

  const newDisbursement = (data.disbursementDate as Date | undefined) ?? loan.disbursementDate ?? null;
  const financialChanged =
    loan.principalAmount !== data.principalAmount ||
    loan.interestRate !== data.interestRate ||
    loan.tenureMonths !== data.tenureMonths ||
    loan.processingFee !== data.processingFee ||
    loan.loanType !== data.loanType ||
    loan.interestPeriod !== data.interestPeriod ||
    loan.interestMethod !== data.interestMethod ||
    !sameDate(newDisbursement, loan.disbursementDate);

  if (financialChanged && paymentCount > 0) {
    throw new ActionError(
      "This loan already has collected payments — financial terms can't be changed. Edit only non-financial fields, or reverse the payments first.",
    );
  }

  // Recompute headline figures from the (possibly new) terms.
  let emiAmount = 0;
  let totalInterest: number;
  let totalPayable: number;
  if (data.loanType === "FLEXIBLE_LOAN") {
    const proj = projectFlexibleAtMaturity(
      {
        principal: data.principalAmount,
        ratePerPeriod: data.interestRate,
        period: data.interestPeriod,
        method: data.interestMethod,
        disbursementDate: newDisbursement ?? new Date(),
      },
      data.tenureMonths,
    );
    totalInterest = proj.totalInterest;
    totalPayable = proj.totalPayable;
  } else {
    const calc = calculateLoan(
      {
        principal: data.principalAmount,
        annualInterestRate: data.interestRate,
        tenureMonths: data.tenureMonths,
        processingFee: data.processingFee,
      },
      data.loanType as LoanMethod,
    );
    emiAmount = calc.emiAmount;
    totalInterest = calc.totalInterest;
    totalPayable = calc.totalPayable;
  }

  const maturityDate = newDisbursement
    ? calculateMaturityDate(newDisbursement, data.tenureMonths)
    : loan.maturityDate ?? null;
  const expectedPaymentDate = maturityDate
    ? resolveExpectedPaymentDate(
        data.repaymentMode,
        (data.expectedPaymentDate as Date | undefined) ?? loan.expectedPaymentDate,
        maturityDate,
      )
    : data.repaymentMode === "FIXED_DATE"
      ? ((data.expectedPaymentDate as Date | undefined) ?? loan.expectedPaymentDate ?? null)
      : null;

  const isDisbursed = loan.status === "ACTIVE" || loan.status === "OVERDUE";
  const wantsSchedule = data.loanType !== "FLEXIBLE_LOAN" && isDisbursed && Boolean(newDisbursement);
  const shouldRebuild = financialChanged && paymentCount === 0 && (scheduleCount > 0 || wantsSchedule);

  return prisma.$transaction(async (tx) => {
    if (shouldRebuild) {
      await tx.emiSchedule.deleteMany({ where: { loanId: loan.id } });
      if (wantsSchedule && newDisbursement) {
        const schedule = generateSchedule(
          {
            principal: data.principalAmount,
            annualInterestRate: data.interestRate,
            tenureMonths: data.tenureMonths,
          },
          data.loanType as LoanMethod,
          newDisbursement,
        );
        await tx.emiSchedule.createMany({
          data: schedule.map((s) => ({
            loanId: loan.id,
            installmentNumber: s.installmentNumber,
            dueDate: s.dueDate,
            emiAmount: s.emiAmount,
            principalComponent: s.principalComponent,
            interestComponent: s.interestComponent,
            remainingBalance: s.remainingBalance,
          })),
        });
      }
    }

    return tx.loan.update({
      where: { id: loan.id },
      data: {
        loanType: data.loanType,
        interestPeriod: data.interestPeriod,
        interestMethod: data.interestMethod,
        repaymentMode: data.repaymentMode,
        expectedPaymentDate,
        gracePeriodDays: data.gracePeriodDays,
        principalAmount: data.principalAmount,
        interestRate: data.interestRate,
        processingFee: data.processingFee,
        tenureMonths: data.tenureMonths,
        purpose: data.purpose,
        emiAmount,
        totalInterest,
        totalPayable,
        disbursementDate: newDisbursement,
        maturityDate,
        // With no payments, outstanding tracks the (possibly new) principal.
        ...(paymentCount === 0 ? { outstandingPrincipal: data.principalAmount } : {}),
        ...(data.assignedAgentId ? { assignedAgentId: data.assignedAgentId } : {}),
      },
    });
  });
}

export async function deleteLoan(id: string) {
  return prisma.loan.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function assignLoanAgent(id: string, agentId: string) {
  return prisma.loan.update({ where: { id }, data: { assignedAgentId: agentId } });
}

/**
 * Recompute overdue state for active loans and their past-due EMIs, honouring
 * each loan's grace period. Run on a cron in production; exposed as an action.
 */
export async function refreshOverdueStatuses() {
  const now = new Date();

  // Candidate EMIs past due — grace is applied per loan. OPEN_ENDED loans are
  // never overdue by time, so they're excluded.
  const candidates = await prisma.emiSchedule.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: now },
      loan: { repaymentMode: { not: "OPEN_ENDED" } },
    },
    select: { id: true, dueDate: true, loan: { select: { gracePeriodDays: true } } },
  });

  const overdueIds = candidates
    .filter((e) => isPastGrace(e.dueDate, e.loan.gracePeriodDays, now))
    .map((e) => e.id);

  if (overdueIds.length) {
    await prisma.emiSchedule.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: "OVERDUE" },
    });
  }

  const loansWithOverdue = await prisma.emiSchedule.findMany({
    where: { status: "OVERDUE" },
    select: { loanId: true },
    distinct: ["loanId"],
  });
  const loanIds = loansWithOverdue.map((l) => l.loanId);
  if (loanIds.length) {
    await prisma.loan.updateMany({
      where: { id: { in: loanIds }, status: "ACTIVE", repaymentMode: { not: "OPEN_ENDED" } },
      data: { status: "OVERDUE" },
    });
  }

  // Single-payment / flexible loans: overdue once past the expected payment
  // date + grace with a balance owing. OPEN_ENDED loans are excluded.
  const dateCandidates = await prisma.loan.findMany({
    where: {
      status: "ACTIVE",
      repaymentMode: { not: "OPEN_ENDED" },
      expectedPaymentDate: { lt: now },
      OR: [{ loanType: "FLEXIBLE_LOAN" }, { emiSchedules: { none: {} } }],
    },
    select: { id: true, expectedPaymentDate: true, gracePeriodDays: true, outstandingPrincipal: true },
  });
  const dateOverdueIds = dateCandidates
    .filter(
      (l) =>
        l.expectedPaymentDate &&
        l.outstandingPrincipal > 0 &&
        isPastGrace(l.expectedPaymentDate, l.gracePeriodDays, now),
    )
    .map((l) => l.id);
  if (dateOverdueIds.length) {
    await prisma.loan.updateMany({
      where: { id: { in: dateOverdueIds } },
      data: { status: "OVERDUE" },
    });
  }

  return {
    overdueEmis: overdueIds.length,
    overdueLoans: loanIds.length + dateOverdueIds.length,
  };
}
