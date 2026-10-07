-- Fase 6: autorización efectiva para generar reportes sin persistir snapshots.
-- El cliente puede ocultar acciones por rol, pero esta función valida auth.uid()
-- contra la membresía activa antes de consultar las fuentes del reporte.

create or replace function public.can_generate_professional_reports(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(
    target_organization_id,
    array['clinic_admin', 'authorized_professional']::public.organization_role[]
  );
$$;

revoke all on function public.can_generate_professional_reports(uuid) from public;
grant execute on function public.can_generate_professional_reports(uuid) to authenticated;
