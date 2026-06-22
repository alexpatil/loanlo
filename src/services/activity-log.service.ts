import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface LogActivityInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Fire-and-forget audit logging. Failures here must never break a mutation,
 * so errors are swallowed (and surfaced to the server console only).
 */
export async function logActivity(input: LogActivityInput) {
  try {
    const h = await headers();
    await prisma.activityLog.create({
      data: {
        userId: input.userId ?? undefined,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? undefined,
        description: input.description,
        metadata: input.metadata,
        ipAddress: h.get("x-forwarded-for")?.split(",")[0] ?? undefined,
        userAgent: h.get("user-agent") ?? undefined,
      },
    });
  } catch (error) {
    console.error("[activity-log] failed to record activity", error);
  }
}

export async function getActivityLogs(limit = 50) {
  return prisma.activityLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true, role: true } } },
  });
}
