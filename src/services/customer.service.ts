import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";
import type { PaginatedResult, CustomerWithRelations } from "@/types";

interface ListCustomersParams {
  search?: string;
  kycStatus?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
  /** When set, restrict to customers assigned to this agent (AGENT scope). */
  scopeAgentId?: string;
}

const agentSelect = { select: { id: true, name: true, email: true } };

export async function listCustomers(
  params: ListCustomersParams = {},
): Promise<PaginatedResult<CustomerWithRelations>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? 10);

  const where: Prisma.CustomerWhereInput = {
    deletedAt: { isSet: false },
    ...(params.scopeAgentId ? { assignedAgentId: params.scopeAgentId } : {}),
    ...(params.agentId ? { assignedAgentId: params.agentId } : {}),
    ...(params.kycStatus ? { kycStatus: params.kycStatus as never } : {}),
    ...(params.search
      ? {
          OR: [
            { firstName: { contains: params.search, mode: "insensitive" } },
            { lastName: { contains: params.search, mode: "insensitive" } },
            { customerCode: { contains: params.search, mode: "insensitive" } },
            { phone: { contains: params.search } },
            { email: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { assignedAgent: agentSelect, _count: { select: { loans: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    items: items as CustomerWithRelations[],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getCustomerById(id: string, scopeAgentId?: string) {
  return prisma.customer.findFirst({
    where: { id, deletedAt: { isSet: false }, ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}) },
    include: {
      assignedAgent: agentSelect,
      documents: { where: { deletedAt: { isSet: false } }, orderBy: { createdAt: "desc" } },
      loans: {
        where: { deletedAt: { isSet: false } },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { emiSchedules: true } } },
      },
    },
  });
}

export async function createCustomer(
  data: Prisma.CustomerCreateInput,
): Promise<CustomerWithRelations> {
  return prisma.customer.create({
    data,
    include: { assignedAgent: agentSelect },
  }) as Promise<CustomerWithRelations>;
}

export async function updateCustomer(id: string, data: Prisma.CustomerUpdateInput) {
  return prisma.customer.update({ where: { id }, data });
}

/** Soft delete. */
export async function deleteCustomer(id: string) {
  return prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function countCustomers(scopeAgentId?: string) {
  return prisma.customer.count({
    where: { deletedAt: { isSet: false }, ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}) },
  });
}

/** Lightweight options list for selects. */
export async function getCustomerOptions(scopeAgentId?: string) {
  return prisma.customer.findMany({
    where: { deletedAt: { isSet: false }, ...(scopeAgentId ? { assignedAgentId: scopeAgentId } : {}) },
    select: { id: true, firstName: true, lastName: true, customerCode: true, phone: true },
    orderBy: { firstName: "asc" },
    take: 500,
  });
}

/** AGENT users only see their own customers; ADMIN+ see all. */
export function scopeForRole(role: Role, userId: string): string | undefined {
  return role === "AGENT" ? userId : undefined;
}
