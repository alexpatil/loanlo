import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { round2 } from "@/lib/utils";

interface ListEmiParams {
  status?: string;
  scopeAgentId?: string;
  page?: number;
  pageSize?: number;
  onlyDue?: boolean;
}

const DUE_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;

/**
 * A unified installment-style row. Real EMI loans contribute one row per
 * `EmiSchedule`; flexible (Non-EMI) loans — which have no schedule — contribute
 * a single synthetic row built from the loan's expected payment date and live
 * outstanding balance, so they surface on the EMI/Collections screens too.
 */
export interface EmiRow {
  id: string;
  source: "EMI" | "LOAN";
  installmentNumber: number | null;
  dueDate: Date;
  emiAmount: number;
  penaltyAmount: number;
  paidAmount: number;
  status: string;
  loan: {
    id: string;
    loanNumber: string;
    customer: { firstName: string; lastName: string; phone: string; customerCode: string };
  };
}

type FlexibleLoanRow = {
  id: string;
  loanNumber: string;
  status: string;
  outstandingPrincipal: number;
  expectedPaymentDate: Date | null;
  maturityDate: Date | null;
  disbursementDate: Date | null;
  customer: { firstName: string; lastName: string; phone: string; customerCode: string };
};

/** Map a flexible loan onto the unified status vocabulary used by EMI rows. */
function flexibleStatus(loan: { status: string; outstandingPrincipal: number }): string {
  if (loan.status === "OVERDUE") return "OVERDUE";
  if (loan.outstandingPrincipal <= 0) return "PAID";
  return "PENDING";
}

function flexibleToRow(loan: FlexibleLoanRow): EmiRow {
  return {
    id: loan.id,
    source: "LOAN",
    installmentNumber: null,
    dueDate: loan.expectedPaymentDate ?? loan.maturityDate ?? loan.disbursementDate ?? new Date(),
    emiAmount: round2(loan.outstandingPrincipal),
    penaltyAmount: 0,
    paidAmount: 0,
    status: flexibleStatus(loan),
    loan: { id: loan.id, loanNumber: loan.loanNumber, customer: loan.customer },
  };
}

/** Live flexible loans (ACTIVE / OVERDUE) within the agent's scope. */
function activeFlexibleLoans(scopeAgentId?: string) {
  return prisma.loan.findMany({
    where: {
      loanType: "FLEXIBLE_LOAN",
      deletedAt: { isSet: false },
      status: { in: ["ACTIVE", "OVERDUE"] },
      ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}),
    },
    select: {
      id: true,
      loanNumber: true,
      status: true,
      outstandingPrincipal: true,
      expectedPaymentDate: true,
      maturityDate: true,
      disbursementDate: true,
      customer: { select: { firstName: true, lastName: true, phone: true, customerCode: true } },
    },
  });
}

export async function listEmiSchedules(params: ListEmiParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? 15);

  const emiWhere: Prisma.EmiScheduleWhereInput = {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.onlyDue ? { status: { in: DUE_STATUSES as unknown as never } } : {}),
    loan: {
      deletedAt: { isSet: false },
      ...(params.scopeAgentId ? { assignedAgentId: params.scopeAgentId } : {}),
    },
  };

  const [emis, flexibleLoans] = await Promise.all([
    prisma.emiSchedule.findMany({
      where: emiWhere,
      include: {
        loan: {
          select: {
            id: true,
            loanNumber: true,
            customer: {
              select: { firstName: true, lastName: true, phone: true, customerCode: true },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 500,
    }),
    activeFlexibleLoans(params.scopeAgentId),
  ]);

  const emiRows: EmiRow[] = emis.map((e) => ({
    id: e.id,
    source: "EMI",
    installmentNumber: e.installmentNumber,
    dueDate: e.dueDate,
    emiAmount: e.emiAmount,
    penaltyAmount: e.penaltyAmount,
    paidAmount: e.paidAmount,
    status: e.status,
    loan: e.loan,
  }));

  // Flexible loans carry no schedule, so the same status/onlyDue filter is
  // applied to their synthetic rows in memory.
  const flexibleRows = flexibleLoans.map(flexibleToRow).filter((r) => {
    if (params.status) return r.status === params.status;
    if (params.onlyDue) return (DUE_STATUSES as readonly string[]).includes(r.status);
    return true;
  });

  const all = [...emiRows, ...flexibleRows].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
  );

  const total = all.length;
  const items = all.slice((page - 1) * pageSize, page * pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getEmiStats(scopeAgentId?: string) {
  const loanScope = {
    loan: { deletedAt: { isSet: false }, ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}) },
  };
  const [pending, overdue, paid, dueAmount, flexibleLoans] = await Promise.all([
    prisma.emiSchedule.count({ where: { ...loanScope, status: "PENDING" } }),
    prisma.emiSchedule.count({ where: { ...loanScope, status: "OVERDUE" } }),
    prisma.emiSchedule.count({ where: { ...loanScope, status: "PAID" } }),
    prisma.emiSchedule.aggregate({
      where: { ...loanScope, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      _sum: { emiAmount: true },
    }),
    activeFlexibleLoans(scopeAgentId),
  ]);

  let flexPending = 0;
  let flexOverdue = 0;
  let flexPaid = 0;
  let flexOutstanding = 0;
  for (const loan of flexibleLoans) {
    const status = flexibleStatus(loan);
    if (status === "OVERDUE") flexOverdue += 1;
    else if (status === "PAID") flexPaid += 1;
    else flexPending += 1;
    if (status !== "PAID") flexOutstanding += loan.outstandingPrincipal;
  }

  return {
    pending: pending + flexPending,
    overdue: overdue + flexOverdue,
    paid: paid + flexPaid,
    outstandingDue: round2((dueAmount._sum.emiAmount ?? 0) + flexOutstanding),
  };
}
