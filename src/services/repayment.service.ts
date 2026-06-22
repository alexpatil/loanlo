import "server-only";
import { startOfDay, endOfDay, addDays } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/utils";

export interface DueItem {
  id: string;
  loanId: string;
  loanNumber: string;
  customerName: string;
  customerPhone: string;
  dueDate: Date;
  amount: number;
  source: "EMI" | "LOAN";
  repaymentMode: string;
}

export interface CustomerCommitment {
  customerName: string;
  phone: string;
  nextDueDate: Date;
  totalDue: number;
  items: number;
}

export interface RepaymentOverview {
  dueToday: { count: number; amount: number };
  dueThisWeek: { count: number; amount: number };
  overdue: { count: number; amount: number };
  upcoming: DueItem[];
  commitments: CustomerCommitment[];
}

/**
 * Unified repayment radar: assembles due "items" from installment EMIs and
 * single-payment / flexible loans (via `expectedPaymentDate`), honouring
 * repayment mode (OPEN_ENDED loans are never due by time) and grace.
 */
export async function getRepaymentOverview(scopeAgentId?: string): Promise<RepaymentOverview> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 6));
  const horizon = endOfDay(addDays(now, 30));

  const loanScope: Prisma.LoanWhereInput = {
    deletedAt: { isSet: false },
    status: { in: ["ACTIVE", "OVERDUE"] },
    repaymentMode: { not: "OPEN_ENDED" },
    ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}),
  };

  // Installment EMIs coming due (or overdue) within the horizon.
  const emis = await prisma.emiSchedule.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      dueDate: { lte: horizon },
      loan: loanScope,
    },
    include: {
      loan: {
        select: {
          id: true,
          loanNumber: true,
          repaymentMode: true,
          customer: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 300,
  });

  // Single-payment / flexible loans with an expected payment date.
  const loans = await prisma.loan.findMany({
    where: {
      ...loanScope,
      expectedPaymentDate: { not: null, lte: horizon },
      outstandingPrincipal: { gt: 0 },
      OR: [{ loanType: "FLEXIBLE_LOAN" }, { emiSchedules: { none: {} } }],
    },
    select: {
      id: true,
      loanNumber: true,
      repaymentMode: true,
      expectedPaymentDate: true,
      outstandingPrincipal: true,
      customer: { select: { firstName: true, lastName: true, phone: true } },
    },
  });

  const items: DueItem[] = [
    ...emis.map((e) => ({
      id: e.id,
      loanId: e.loan.id,
      loanNumber: e.loan.loanNumber,
      customerName: `${e.loan.customer.firstName} ${e.loan.customer.lastName}`,
      customerPhone: e.loan.customer.phone,
      dueDate: e.dueDate,
      amount: round2(Math.max(0, e.emiAmount + e.penaltyAmount - e.paidAmount)),
      source: "EMI" as const,
      repaymentMode: e.loan.repaymentMode,
    })),
    ...loans.map((l) => ({
      id: l.id,
      loanId: l.id,
      loanNumber: l.loanNumber,
      customerName: `${l.customer.firstName} ${l.customer.lastName}`,
      customerPhone: l.customer.phone,
      dueDate: l.expectedPaymentDate as Date,
      amount: round2(l.outstandingPrincipal),
      source: "LOAN" as const,
      repaymentMode: l.repaymentMode,
    })),
  ];

  const inRange = (d: Date, from: Date, to: Date) => d >= from && d <= to;
  const sum = (xs: DueItem[]) => round2(xs.reduce((a, b) => a + b.amount, 0));

  const todayItems = items.filter((i) => inRange(i.dueDate, todayStart, todayEnd));
  const weekItems = items.filter((i) => inRange(i.dueDate, todayStart, weekEnd));
  const upcoming = items
    .filter((i) => i.dueDate >= todayStart)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 8);

  // Overdue is driven by loan status (kept current by refreshOverdueStatuses).
  const overdueLoans = await prisma.loan.findMany({
    where: {
      status: "OVERDUE",
      deletedAt: { isSet: false },
      ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}),
    },
    select: { outstandingPrincipal: true },
  });

  // Customer commitments: upcoming dues grouped per customer.
  const byCustomer = new Map<string, CustomerCommitment>();
  for (const i of items.filter((x) => x.dueDate >= todayStart)) {
    const key = `${i.customerName}|${i.customerPhone}`;
    const existing = byCustomer.get(key);
    if (existing) {
      existing.totalDue = round2(existing.totalDue + i.amount);
      existing.items += 1;
      if (i.dueDate < existing.nextDueDate) existing.nextDueDate = i.dueDate;
    } else {
      byCustomer.set(key, {
        customerName: i.customerName,
        phone: i.customerPhone,
        nextDueDate: i.dueDate,
        totalDue: i.amount,
        items: 1,
      });
    }
  }
  const commitments = [...byCustomer.values()]
    .sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime())
    .slice(0, 6);

  return {
    dueToday: { count: todayItems.length, amount: sum(todayItems) },
    dueThisWeek: { count: weekItems.length, amount: sum(weekItems) },
    overdue: {
      count: overdueLoans.length,
      amount: round2(overdueLoans.reduce((a, b) => a + b.outstandingPrincipal, 0)),
    },
    upcoming,
    commitments,
  };
}
