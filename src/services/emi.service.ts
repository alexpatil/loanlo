import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface ListEmiParams {
  status?: string;
  scopeAgentId?: string;
  page?: number;
  pageSize?: number;
  onlyDue?: boolean;
}

export async function listEmiSchedules(params: ListEmiParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? 15);

  const where: Prisma.EmiScheduleWhereInput = {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.onlyDue ? { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } } : {}),
    loan: {
      deletedAt: { isSet: false },
      ...(params.scopeAgentId ? { assignedAgentId: params.scopeAgentId } : {}),
    },
  };

  const [items, total] = await Promise.all([
    prisma.emiSchedule.findMany({
      where,
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.emiSchedule.count({ where }),
  ]);

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
  const [pending, overdue, paid, dueAmount] = await Promise.all([
    prisma.emiSchedule.count({ where: { ...loanScope, status: "PENDING" } }),
    prisma.emiSchedule.count({ where: { ...loanScope, status: "OVERDUE" } }),
    prisma.emiSchedule.count({ where: { ...loanScope, status: "PAID" } }),
    prisma.emiSchedule.aggregate({
      where: { ...loanScope, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      _sum: { emiAmount: true },
    }),
  ]);

  return {
    pending,
    overdue,
    paid,
    outstandingDue: dueAmount._sum.emiAmount ?? 0,
  };
}
