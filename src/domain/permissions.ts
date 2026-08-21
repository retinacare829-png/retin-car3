import type { Role } from "./roles";

export const permissions = [
  "organization:manage",
  "users:manage",
  "dashboard:view",
  "patients:write",
  "patients:read",
  "screenings:create",
  "screenings:review",
  "images:upload",
  "images:delete",
  "quality:record",
  "reports:generate",
  "audit:view",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  clinic_admin: new Set([
    "organization:manage",
    "users:manage",
    "dashboard:view",
    "patients:write",
    "patients:read",
    "screenings:create",
    "screenings:review",
    "images:upload",
    "images:delete",
    "quality:record",
    "reports:generate",
    "audit:view",
  ]),
  technical_staff: new Set([
    "dashboard:view",
    "patients:write",
    "patients:read",
    "screenings:create",
    "images:upload",
    "quality:record",
  ]),
  authorized_professional: new Set([
    "dashboard:view",
    "patients:read",
    "screenings:review",
    "quality:record",
    "reports:generate",
  ]),
};

export function can(role: Role, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}
