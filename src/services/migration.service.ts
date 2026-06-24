import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, LoanStatus } from "@prisma/client";
import { calculateLoan, calculateMaturityDate, type LoanMethod } from "@/lib/finance";
import { projectFlexibleAtMaturity } from "@/lib/interest-engine";
import { round2 } from "@/lib/utils";
import { nextLoanNumber } from "./sequence.service";
import { resolveExpectedPaymentDate, resolveLoanAgentId } from "./loan.service";
import type { MigrationInput } from "@/validations/migration.schema";

/**
 * Import a loan from a physical register with historical data:
 * - historical disbursement date + manually-selected status,
 * - authoritative current outstanding balance,
 * - historical collections (itemised, or a single opening lump sum),
 * - `isMigrated` flag so it can be reported separately.
 *
 * No EMI schedule is generated — the entered outstanding is authoritative and
 * the ledger is reconstructed from the historical collections.
 */
export async function migrateLoan(data: MigrationInput, userId: string) {
  const loanNumber = await nextLoanNumber();

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
        disbursementDate: data.disbursementDate,
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

  const maturityDate = calculateMaturityDate(data.disbursementDate, data.tenureMonths);
  const expectedPaymentDate = resolveExpectedPaymentDate(
    data.repaymentMode,
    (data.expectedPaymentDate as Date | undefined) ?? null,
    maturityDate,
  );

  // Build the historical collection rows (itemised, else a single lump sum).
  const collections: { amount: number; date: Date }[] =
    data.historicalCollections && data.historicalCollections.length > 0
      ? data.historicalCollections.map((c) => ({ amount: round2(c.amount), date: c.date }))
      : data.totalCollected > 0
        ? [{ amount: round2(data.totalCollected), date: data.disbursementDate }]
        : [];

  // Inherit the customer's assigned agent; fall back to the migrating user.
  const resolvedAgentId = await resolveLoanAgentId(data.assignedAgentId, data.customerId, userId);

  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        loanNumber,
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
        emiAmount,
        totalInterest,
        totalPayable,
        outstandingPrincipal: round2(data.currentOutstanding),
        status: data.status as LoanStatus,
        disbursementDate: data.disbursementDate,
        maturityDate,
        purpose: data.note,
        isMigrated: true,
        migratedAt: new Date(),
        migrationNote: data.note,
        customer: { connect: { id: data.customerId } },
        createdBy: { connect: { id: userId } },
        approvedBy: { connect: { id: userId } },
        assignedAgent: { connect: { id: resolvedAgentId } },
      },
      include: { customer: { select: { id: true } } },
    });

    if (collections.length > 0) {
      await tx.payment.createMany({
        data: collections.map((c) => ({
          loanId: loan.id,
          customerId: loan.customerId,
          amount: c.amount,
          principalAmount: c.amount, // best-effort: register collections recorded against principal
          interestAmount: 0,
          penaltyAmount: 0,
          paymentDate: c.date,
          paymentMethod: "CASH" as const,
          isMigrated: true,
          notes: "Historical collection (migrated)",
          collectedById: userId,
        })),
      });
    }

    // Migrated loans are historical imports from a physical register — the money
    // moved before this system existed. They must NOT touch the cash book: no
    // LOAN_DISBURSEMENT outflow (which would wrongly debit Cash Available and
    // inflate "Loans Disbursed") and no COLLECTION_RECEIVED inflow. A migrated
    // loan only affects Outstanding, Active/Overdue counts and customer history.

    return loan;
  });
}

interface MigratedListParams {
  scopeAgentId?: string;
  page?: number;
  pageSize?: number;
}

export async function listMigratedLoans(params: MigratedListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? 15);
  const where: Prisma.LoanWhereInput = {
    deletedAt: { isSet: false },
    isMigrated: true,
    ...(params.scopeAgentId ? { assignedAgentId: params.scopeAgentId } : {}),
  };

  const [items, total, agg] = await Promise.all([
    prisma.loan.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, customerCode: true } },
      },
      orderBy: { migratedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.loan.count({ where }),
    prisma.loan.aggregate({ where, _sum: { outstandingPrincipal: true, principalAmount: true } }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    totalOutstanding: agg._sum.outstandingPrincipal ?? 0,
    totalPrincipal: agg._sum.principalAmount ?? 0,
  };
}

export async function getMigrationStats(scopeAgentId?: string) {
  const where: Prisma.LoanWhereInput = {
    deletedAt: { isSet: false },
    isMigrated: true,
    ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}),
  };
  const [count, agg] = await Promise.all([
    prisma.loan.count({ where }),
    prisma.loan.aggregate({ where, _sum: { outstandingPrincipal: true } }),
  ]);
  return { count, outstanding: agg._sum.outstandingPrincipal ?? 0 };
}
