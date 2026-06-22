import "server-only";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function listUsers(role?: Role) {
  return prisma.user.findMany({
    where: { deletedAt: { isSet: false }, ...(role ? { role } : {}) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      isActive: true,
      image: true,
      createdAt: true,
      _count: { select: { assignedCustomers: true, assignedLoans: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAgentOptions() {
  return prisma.user.findMany({
    where: { deletedAt: { isSet: false }, isActive: true, role: { in: ["AGENT", "ADMIN"] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function updateUser(
  id: string,
  data: { name?: string; phone?: string; role?: Role; isActive?: boolean },
) {
  return prisma.user.update({ where: { id }, data });
}

export async function setUserRole(id: string, role: Role) {
  return prisma.user.update({ where: { id }, data: { role } });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
