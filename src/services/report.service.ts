import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { round2 } from "@/lib/utils";

interface ReportRange {
  from?: Date;
  to?: Date;
  scopeAgentId?: string;
}

export async function getLoanReport({ from, to, scopeAgentId }: ReportRange) {
  const where: Prisma.LoanWhereInput = {
    deletedAt: { isSet: false },
    ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  return prisma.loan.findMany({
    where,
    include: {
      customer: { select: { firstName: true, lastName: true, customerCode: true, phone: true } },
      assignedAgent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCollectionReport({ from, to, scopeAgentId }: ReportRange) {
  const where: Prisma.PaymentWhereInput = {
    deletedAt: { isSet: false },
    ...(scopeAgentId ? { loan: { assignedAgentId: scopeAgentId } } : {}),
    ...(from || to
      ? { paymentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  return prisma.payment.findMany({
    where,
    include: {
      loan: { select: { loanNumber: true } },
      customer: { select: { firstName: true, lastName: true, customerCode: true } },
      collectedBy: { select: { name: true } },
    },
    orderBy: { paymentDate: "desc" },
  });
}

export async function getCustomerReport(scopeAgentId?: string) {
  return prisma.customer.findMany({
    where: { deletedAt: { isSet: false }, ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}) },
    include: {
      assignedAgent: { select: { name: true } },
      _count: { select: { loans: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Profit & revenue, split into two views:
 *  - REALIZED (collected): interest/penalty actually received via payments.
 *  - ON THE BOOK (expected): total interest the live loans will earn over their
 *    life, plus the principal still outstanding.
 *
 * Showing only collected interest made the report read as ₹0 whenever no
 * payments existed yet — even with interest-bearing loans on the book.
 */
export async function getProfitReport({ from, to, scopeAgentId }: ReportRange) {
  const paymentWhere: Prisma.PaymentWhereInput = {
    deletedAt: { isSet: false },
    ...(scopeAgentId ? { loan: { assignedAgentId: scopeAgentId } } : {}),
    ...(from || to
      ? { paymentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  // Loans that represent disbursed capital (book of business).
  const bookWhere: Prisma.LoanWhereInput = {
    deletedAt: { isSet: false },
    status: { in: ["ACTIVE", "CLOSED", "OVERDUE"] },
    ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}),
    ...(from || to
      ? { disbursementDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  // Loans still owing money (for outstanding principal).
  const outstandingWhere: Prisma.LoanWhereInput = {
    deletedAt: { isSet: false },
    status: { in: ["ACTIVE", "OVERDUE"] },
    ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}),
  };

  const [paymentAgg, bookAgg, outstandingAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: paymentWhere,
      _sum: { interestAmount: true, penaltyAmount: true, principalAmount: true, amount: true },
    }),
    prisma.loan.aggregate({
      where: bookWhere,
      _sum: { processingFee: true, principalAmount: true, totalInterest: true },
    }),
    prisma.loan.aggregate({
      where: outstandingWhere,
      _sum: { outstandingPrincipal: true },
    }),
  ]);

  const interestCollected = paymentAgg._sum.interestAmount ?? 0;
  const penaltyCollected = paymentAgg._sum.penaltyAmount ?? 0;
  const processingFees = bookAgg._sum.processingFee ?? 0;
  const expectedInterest = bookAgg._sum.totalInterest ?? 0;

  return {
    // Realized (collected)
    interestCollected,
    penaltyCollected,
    totalCollected: paymentAgg._sum.amount ?? 0,
    principalCollected: paymentAgg._sum.principalAmount ?? 0,
    realizedProfit: round2(interestCollected + penaltyCollected + processingFees),
    // On the book (expected)
    principalDisbursed: bookAgg._sum.principalAmount ?? 0,
    outstandingPrincipal: outstandingAgg._sum.outstandingPrincipal ?? 0,
    expectedInterest,
    processingFees,
    expectedProfit: round2(expectedInterest + processingFees),
  };
}
