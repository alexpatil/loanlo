import "server-only";
import { z } from "zod";
import type { Role } from "@prisma/client";
import type { ActionResult } from "@/types";
import { getCurrentUser } from "./session";
import { can, hasMinRole, type Permission } from "./rbac";

export class ActionError extends Error {}

/** Resolve the authenticated user inside a server action (throws if absent). */
export async function getActionUser() {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("You must be signed in.");
  return user;
}

export async function requireActionPermission(permission: Permission) {
  const user = await getActionUser();
  if (!can(user.role as Role, permission)) {
    throw new ActionError("You do not have permission to do that.");
  }
  return user;
}

export async function requireActionRole(min: Role) {
  const user = await getActionUser();
  if (!hasMinRole(user.role as Role, min)) {
    throw new ActionError("You do not have permission to do that.");
  }
  return user;
}

/** AGENTs are scoped to their own records; ADMIN+ see everything. */
export function agentScope(role: Role, userId: string): string | undefined {
  return role === "AGENT" ? userId : undefined;
}

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { success: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { success: false, error, fieldErrors };
}

/**
 * Validate `input` with `schema`, returning a typed value or a flattened
 * field-error result ready to send back to React Hook Form.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown):
  | { ok: true; data: z.infer<S> }
  | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      result: fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors as Record<string, string[]>),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Wrap an action body so thrown ActionErrors become clean results. */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ActionError) return fail(error.message);
    console.error("[action] unexpected error", error);
    return fail("Something went wrong. Please try again.");
  }
}
