import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { OrganizationContext } from "../services/organizationService";
import { supabase } from "../lib/supabase";
import { OrganizationService } from "../services/organizationService";
import type { ClinicTheme } from "../domain/clinicBranding";

export interface UseOrganizationContextResult {
  loading: boolean;
  organizations: OrganizationContext[];
  activeOrganization: OrganizationContext | null;
  error: string | null;
  selectOrganization: (organizationId: string) => void;
  registerClinic: (name: string) => Promise<void>;
  saveBranding: (theme: ClinicTheme, logo: File | null) => Promise<void>;
  logoRevision: number;
}

export function useOrganizationContext(user: User | null): UseOrganizationContextResult {
  const service = useMemo(() => (supabase ? new OrganizationService(supabase) : null), []);
  const [organizations, setOrganizations] = useState<OrganizationContext[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoRevision, setLogoRevision] = useState(0);

  useEffect(() => {
    if (!service || !user) {
      setOrganizations([]);
      setActiveOrganizationId(null);
      return;
    }

    let mounted = true;
    setLoading(true);

    service
      .listCurrentUserOrganizations(user.id)
      .then((contexts) => {
        if (!mounted) {
          return;
        }

        setOrganizations(contexts);
        setActiveOrganizationId((current) => current ?? contexts[0]?.organization.id ?? null);
      })
      .catch((caught: unknown) => {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : "No se pudieron cargar las organizaciones.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [service, user]);

  const activeOrganization =
    organizations.find((context) => context.organization.id === activeOrganizationId) ?? null;

  async function registerClinic(name: string) {
    if (!service || !user) throw new Error("Inicie sesión para registrar una clínica.");
    const organizationId = await service.registerClinic(name);
    setOrganizations(await service.listCurrentUserOrganizations(user.id));
    setActiveOrganizationId(organizationId);
  }

  async function saveBranding(theme: ClinicTheme, logo: File | null) {
    if (!service || !user || !activeOrganization) throw new Error("Seleccione una clínica activa.");
    await service.saveBranding(activeOrganization.organization.id, theme, logo);
    setOrganizations(await service.listCurrentUserOrganizations(user.id));
    setLogoRevision((revision) => revision + 1);
  }

  return {
    loading,
    organizations,
    activeOrganization,
    error,
    selectOrganization: setActiveOrganizationId,
    registerClinic,
    saveBranding,
    logoRevision,
  };
}
