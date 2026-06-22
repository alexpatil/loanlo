import type { Role } from "@prisma/client";

/**
 * Role hierarchy + capability matrix for the whole app.
 * A higher rank inherits all the privileges of lower ranks.
 */
export const ROLE_RANK: Record<Role, number> = {
  AGENT: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export type Permission =
  | "customer:read"
  | "customer:write"
  | "customer:delete"
  | "loan:read"
  | "loan:write"
  | "loan:edit"
  | "loan:approve"
  | "loan:delete"
  | "payment:read"
  | "payment:write"
  | "report:read"
  | "cash:read"
  | "cash:manage"
  | "settings:manage"
  | "user:manage"
  | "user:assign"
  | "activity:read";

const AGENT_PERMISSIONS: Permission[] = [
  "customer:read",
  "customer:write",
  "loan:read",
  "loan:write",
  "payment:read",
  "payment:write",
  "report:read",
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...AGENT_PERMISSIONS,
  "customer:delete",
  "loan:edit", // correct agent mistakes
  "loan:approve",
  "loan:delete",
  "cash:read",
  "cash:manage",
  "settings:manage",
  "user:assign",
  "activity:read",
];

const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  ...ADMIN_PERMISSIONS,
  "user:manage",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  AGENT: AGENT_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  SUPER_ADMIN: SUPER_ADMIN_PERMISSIONS,
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasMinRole(role: Role | undefined | null, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function isAdminLike(role: Role | undefined | null): boolean {
  return hasMinRole(role, "ADMIN");
}
