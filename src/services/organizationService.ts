import type { Organization } from "../domain/organization";
import type { Role } from "../domain/roles";
import type { TypedSupabaseClient } from "../lib/supabase";

export interface OrganizationContext {
  organization: Organization;
  role: Role;
}

interface OrganizationMemberWithOrganization {
  role: Role;
  organizations: {
    id: string;
    name: string;
    country_code: string;
    timezone: string;
  } | null;
}

export class OrganizationService {
  constructor(private readonly client: TypedSupabaseClient) {}

  async listCurrentUserOrganizations(userId: string): Promise<OrganizationContext[]> {
    const { data, error } = await this.client
      .from("organization_members")
      .select("role, organizations(id, name, country_code, timezone)")
      .eq("user_id", userId)
      .eq("status", "active")
      .returns<OrganizationMemberWithOrganization[]>();

    if (error) {
      throw error;
    }

    return (data ?? []).flatMap((membership) => {
      if (!membership.organizations) {
        return [];
      }

      return {
        role: membership.role,
        organization: {
          id: membership.organizations.id,
          name: membership.organizations.name,
          countryCode: membership.organizations.country_code,
          timezone: membership.organizations.timezone,
        },
      };
    });
  }
}
