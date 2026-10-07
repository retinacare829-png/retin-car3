import type { Role } from "./roles";
import type { ClinicTheme } from "./clinicBranding";

export type OrganizationMemberStatus = "active" | "invited" | "suspended";

export interface Organization {
  id: string;
  name: string;
  countryCode: string;
  timezone: string;
  brandTheme: ClinicTheme;
  logoPath: string | null;
}

export interface OrganizationMembership {
  organizationId: string;
  userId: string;
  role: Role;
  status: OrganizationMemberStatus;
}

export function canAccessOrganization(
  userId: string,
  organizationId: string,
  memberships: readonly OrganizationMembership[],
): boolean {
  return memberships.some(
    (membership) =>
      membership.userId === userId &&
      membership.organizationId === organizationId &&
      membership.status === "active",
  );
}

export function canManageOrganizationMembers(
  userId: string,
  organizationId: string,
  memberships: readonly OrganizationMembership[],
): boolean {
  return memberships.some(
    (membership) =>
      membership.userId === userId &&
      membership.organizationId === organizationId &&
      membership.role === "clinic_admin" &&
      membership.status === "active",
  );
}
