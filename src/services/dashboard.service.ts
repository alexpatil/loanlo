import "server-only";
import { prisma } from "@/lib/prisma";
import { startOfMonth, subMonths, format } from "date-fns";
import type { Prisma } from "@prisma/client";
import type {
  DashboardStats,
  CollectionTrendPoint,
  LoanStatusBreakdown,
} from "@/types";

function loanScope(scopeAgentId?: string): Prisma.LoanWhereInput {
  return { deletedAt: { isSet: false }, ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}) };
}

export async function getDashboardStats(scopeAgentId?: string): Promise<DashboardStats> {
  const scope = loanScope(scopeAgentId);
  const monthStart = startOfMonth(new Date());

  const [
    totalLoans,
    activeLoans,
    closedLoans,
    overdueLoans,
    pendingLoans,
    totalCustomers,
    disbursedAgg,
    monthDisbursedAgg,
    collectionAgg,
    monthCollectionAgg,
    outstandingAgg,
  ] = await Promise.all([
    prisma.loan.count({ where: scope }),
    prisma.loan.count({ where: { ...scope, status: "ACTIVE" } }),
    prisma.loan.count({ where: { ...scope, status: "CLOSED" } }),
    prisma.loan.count({ where: { ...scope, status: "OVERDUE" } }),
    prisma.loan.count({ where: { ...scope, status: "PENDING" } }),
    prisma.customer.count({
      where: { deletedAt: { isSet: false }, ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}) },
    }),
    prisma.loan.aggregate({
      where: { ...scope, status: { in: ["ACTIVE", "CLOSED", "OVERDUE"] } },
      _sum: { principalAmount: true },
    }),
    prisma.loan.aggregate({
      where: { ...scope, disbursementDate: { gte: monthStart } },
      _sum: { principalAmount: true },
    }),
    prisma.payment.aggregate({
      where: {
        deletedAt: { isSet: false },
        ...(scopeAgentId ? { loan: { assignedAgentId: scopeAgentId } } : {}),
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        deletedAt: { isSet: false },
        paymentDate: { gte: monthStart },
        ...(scopeAgentId ? { loan: { assignedAgentId: scopeAgentId } } : {}),
      },
      _sum: { amount: true },
    }),
    // Use the live outstanding field so non-EMI loans (which have no EMI
    // schedule) are counted the same way as EMI loans.
    prisma.loan.aggregate({
      where: { ...scope, status: { in: ["ACTIVE", "OVERDUE"] } },
      _sum: { outstandingPrincipal: true },
    }),
  ]);

  return {
    totalLoans,
    activeLoans,
    closedLoans,
    overdueLoans,
    pendingLoans,
    totalCustomers,
    totalDisbursed: disbursedAgg._sum.principalAmount ?? 0,
    monthlyDisbursement: monthDisbursedAgg._sum.principalAmount ?? 0,
    totalCollection: collectionAgg._sum.amount ?? 0,
    monthlyCollection: monthCollectionAgg._sum.amount ?? 0,
    outstandingPrincipal: outstandingAgg._sum.outstandingPrincipal ?? 0,
  };
}

/** Last 6 months of collection vs disbursement. */
export async function getCollectionTrend(
  scopeAgentId?: string,
  months = 6,
): Promise<CollectionTrendPoint[]> {
  const now = new Date();
  const points: CollectionTrendPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = startOfMonth(subMonths(now, i));
    const end = startOfMonth(subMonths(now, i - 1));

    const [collection, disbursement] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          deletedAt: { isSet: false },
          paymentDate: { gte: start, lt: end },
          ...(scopeAgentId ? { loan: { assignedAgentId: scopeAgentId } } : {}),
        },
        _sum: { amount: true },
      }),
      prisma.loan.aggregate({
        where: {
          deletedAt: { isSet: false },
          disbursementDate: { gte: start, lt: end },
          ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}),
        },
        _sum: { principalAmount: true },
      }),
    ]);

    points.push({
      month: format(start, "MMM"),
      collection: collection._sum.amount ?? 0,
      disbursement: disbursement._sum.principalAmount ?? 0,
    });
  }

  return points;
}

export interface LoanTypeBreakdown {
  loanType: string;
  count: number;
  principal: number;
  outstanding: number;
}

export async function getLoanTypeBreakdown(
  scopeAgentId?: string,
): Promise<LoanTypeBreakdown[]> {
  const grouped = await prisma.loan.groupBy({
    by: ["loanType"],
    where: loanScope(scopeAgentId),
    _count: { _all: true },
    _sum: { principalAmount: true, outstandingPrincipal: true },
  });

  return grouped.map((g) => ({
    loanType: g.loanType,
    count: g._count._all,
    principal: g._sum.principalAmount ?? 0,
    outstanding: g._sum.outstandingPrincipal ?? 0,
  }));
}

export interface ActivityItem {
  id: string;
  kind: "COLLECTION" | "LOAN";
  title: string;
  subtitle: string;
  amount: number;
  date: Date;
  href: string;
}

/**
 * Unified recent-activity feed: the latest collections and new loans, merged
 * and sorted by recency — a human-readable pulse of the business.
 */
export async function getRecentActivity(
  scopeAgentId?: string,
  limit = 8,
): Promise<ActivityItem[]> {
  const [payments, loans] = await Promise.all([
    prisma.payment.findMany({
      where: {
        deletedAt: { isSet: false },
        ...(scopeAgentId ? { loan: { assignedAgentId: scopeAgentId } } : {}),
      },
      orderBy: { paymentDate: "desc" },
      take: limit,
      include: {
        customer: { select: { firstName: true, lastName: true } },
        loan: { select: { id: true, loanNumber: true } },
      },
    }),
    prisma.loan.findMany({
      where: loanScope(scopeAgentId),
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { customer: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const items: ActivityItem[] = [
    ...payments.map((p) => ({
      id: `pay-${p.id}`,
      kind: "COLLECTION" as const,
      title: `Payment from ${p.customer.firstName} ${p.customer.lastName}`,
      subtitle: p.loan.loanNumber,
      amount: p.amount,
      date: p.paymentDate,
      href: `/loans/${p.loan.id}`,
    })),
    ...loans.map((l) => ({
      id: `loan-${l.id}`,
      kind: "LOAN" as const,
      title: `New loan · ${l.customer.firstName} ${l.customer.lastName}`,
      subtitle: l.loanNumber,
      amount: l.principalAmount,
      date: l.createdAt,
      href: `/loans/${l.id}`,
    })),
  ];

  return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}

export async function getLoanStatusBreakdown(
  scopeAgentId?: string,
): Promise<LoanStatusBreakdown[]> {
  const grouped = await prisma.loan.groupBy({
    by: ["status"],
    where: loanScope(scopeAgentId),
    _count: { _all: true },
    _sum: { principalAmount: true },
  });

  return grouped.map((g) => ({
    status: g.status,
    count: g._count._all,
    amount: g._sum.principalAmount ?? 0,
  }));
}
