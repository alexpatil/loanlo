import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "./auth";
import { hasMinRole, type Permission, can } from "./rbac";

/**
 * Read the current session in a Server Component / Server Action.
 * Wrapped in React `cache` so it runs once per request.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/** Redirects to /login when unauthenticated. Returns the user otherwise. */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Enforces a minimum role; redirects to /unauthorized when below it. */
export async function requireRole(min: Role) {
  const user = await requireAuth();
  if (!hasMinRole(user.role as Role, min)) redirect("/unauthorized");
  return user;
}

/** Enforces a specific permission. */
export async function requirePermission(permission: Permission) {
  const user = await requireAuth();
  if (!can(user.role as Role, permission)) redirect("/unauthorized");
  return user;
}
