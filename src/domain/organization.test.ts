import { describe, expect, it } from "vitest";
import { canAccessOrganization, canManageOrganizationMembers } from "./organization";

const memberships = [
  {
    organizationId: "clinic-a",
    userId: "admin-a",
    role: "clinic_admin",
    status: "active",
  },
  {
    organizationId: "clinic-a",
    userId: "tech-a",
    role: "technical_staff",
    status: "active",
  },
  {
    organizationId: "clinic-b",
    userId: "admin-b",
    role: "clinic_admin",
    status: "active",
  },
  {
    organizationId: "clinic-b",
    userId: "suspended-b",
    role: "clinic_admin",
    status: "suspended",
  },
] as const;

describe("multi-tenant organization isolation", () => {
  it("allows active members to access only their own organization", () => {
    expect(canAccessOrganization("admin-a", "clinic-a", memberships)).toBe(true);
    expect(canAccessOrganization("admin-a", "clinic-b", memberships)).toBe(false);
  });

  it("ignores suspended memberships", () => {
    expect(canAccessOrganization("suspended-b", "clinic-b", memberships)).toBe(false);
  });

  it("limits member management to active clinic admins in the same organization", () => {
    expect(canManageOrganizationMembers("admin-a", "clinic-a", memberships)).toBe(true);
    expect(canManageOrganizationMembers("admin-a", "clinic-b", memberships)).toBe(false);
    expect(canManageOrganizationMembers("tech-a", "clinic-a", memberships)).toBe(false);
  });
});
