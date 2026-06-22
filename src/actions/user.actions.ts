"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAgentSchema, updateUserSchema } from "@/validations/user.schema";
import { updateUser } from "@/services/user.service";
import { logActivity } from "@/services/activity-log.service";
import {
  requireActionRole,
  requireActionPermission,
  parseInput,
  ok,
  fail,
  runAction,
} from "@/lib/action-utils";

/**
 * Create a staff account (AGENT/ADMIN). Only SUPER_ADMIN may mint ADMINs.
 * Hashes the password through BetterAuth's context and writes the credential
 * account directly so no session is created for the new user.
 */
export async function createAgentAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActionRole("ADMIN");
    const parsed = parseInput(createAgentSchema, input);
    if (!parsed.ok) return parsed.result;
    const data = parsed.data;

    if (data.role !== "AGENT" && actor.role !== "SUPER_ADMIN") {
      return fail("Only a Super Admin can create Admin accounts.");
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return fail("A user with this email already exists.");

    const ctx = await auth.$context;
    const hashed = await ctx.password.hash(data.password);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role as Role,
        emailVerified: true,
        accounts: {
          create: {
            accountId: data.email,
            providerId: "credential",
            password: hashed,
          },
        },
      },
    });

    await logActivity({
      userId: actor.id,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      description: `Created ${data.role} ${data.email}`,
    });

    revalidatePath("/admin/agents");
    return ok({ id: user.id }, "Team member created.");
  });
}

export async function updateUserAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActionPermission("user:assign");
    const parsed = parseInput(updateUserSchema, input);
    if (!parsed.ok) return parsed.result;
    const { id, role, ...rest } = parsed.data;

    if (role && actor.role !== "SUPER_ADMIN") {
      return fail("Only a Super Admin can change roles.");
    }

    await updateUser(id, { ...rest, ...(role ? { role: role as Role } : {}) });
    await logActivity({
      userId: actor.id,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      description: `Updated team member ${id}`,
    });

    revalidatePath("/admin/agents");
    return ok(null, "Team member updated.");
  });
}

export async function toggleUserActiveAction(id: string, isActive: boolean) {
  return runAction(async () => {
    const actor = await requireActionRole("ADMIN");
    await updateUser(id, { isActive });
    await logActivity({
      userId: actor.id,
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entity: "User",
      entityId: id,
    });
    revalidatePath("/admin/agents");
    return ok(null, isActive ? "Account activated." : "Account deactivated.");
  });
}
