import type { Organization } from "../domain/organization";
import { paletteFromLogo, validateClinicLogo, type ClinicTheme } from "../domain/clinicBranding";
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
    brand_theme: ClinicTheme;
    logo_path: string | null;
  } | null;
}

export class OrganizationService {
  constructor(private readonly client: TypedSupabaseClient) {}

  async listCurrentUserOrganizations(userId: string): Promise<OrganizationContext[]> {
    const { data, error } = await this.client
      .from("organization_members")
      .select("role, organizations(id, name, country_code, timezone, brand_theme, logo_path)")
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
          brandTheme: membership.organizations.brand_theme,
          logoPath: membership.organizations.logo_path,
        },
      };
    });
  }

  async registerClinic(name: string): Promise<string> {
    const { data, error } = await this.client.rpc("register_clinic", { clinic_name: name.trim() });
    if (error) throw error;
    if (!data) throw new Error("No se recibió la clínica creada.");
    return data;
  }

  async saveBranding(organizationId: string, theme: ClinicTheme, logo: File | null): Promise<void> {
    if (logo) {
      const validationError = validateClinicLogo(logo);
      if (validationError) throw new Error(validationError);
      await paletteFromLogo(logo);
      const path = `${organizationId}/logo`;
      const { error: uploadError } = await this.client.storage
        .from("clinic-branding-private")
        .upload(path, logo, { upsert: true, contentType: logo.type, cacheControl: "0" });
      if (uploadError) throw uploadError;
      const { error: updateError } = await this.client.from("organizations")
        .update({ brand_theme: theme, logo_path: path })
        .eq("id", organizationId)
        .select("id")
        .single();
      if (updateError) throw updateError;
      return;
    }
    const { error } = await this.client.from("organizations")
      .update({ brand_theme: theme })
      .eq("id", organizationId)
      .select("id")
      .single();
    if (error) throw error;
  }

  async downloadLogo(path: string): Promise<Blob> {
    const { data, error } = await this.client.storage.from("clinic-branding-private").download(path);
    if (error) throw error;
    return data;
  }
}
