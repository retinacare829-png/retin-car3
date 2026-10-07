-- Fase 6: un reporte se arma desde filas existentes; esta prueba valida
-- que el conjunto fuente siga limitado por organization_id/RLS.
\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'QA_ASSERTION_FAILED: %', message;
  end if;
end;
$$;

select pg_temp.assert_true(
  exists (
    select 1
    from pg_proc
    where oid = 'public.can_generate_professional_reports(uuid)'::regprocedure
      and not prosecdef
  ),
  'la funcion de acceso a reportes debe ejecutarse como SECURITY INVOKER'
);
select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.can_generate_professional_reports(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_generate_professional_reports(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.has_org_role(uuid, public.organization_role[])', 'EXECUTE')
  and not has_function_privilege('anon', 'public.has_org_role(uuid, public.organization_role[])', 'EXECUTE'),
  'solo authenticated debe ejecutar las funciones de autorización de reportes'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);

select pg_temp.assert_true(
  public.can_generate_professional_reports('10000000-0000-4000-8000-000000000001'),
  'el profesional autorizado debe poder generar reportes en su organización'
);
select pg_temp.assert_true(
  not public.can_generate_professional_reports('10000000-0000-4000-8000-000000000002'),
  'el profesional autorizado no debe generar reportes en otra organización'
);

select pg_temp.assert_true(
  (select count(*) from public.screenings where organization_id = '10000000-0000-4000-8000-000000000001' and status in ('REVISADO', 'SEGUIMIENTO_REQUERIDO', 'CERRADO')) > 0,
  'el profesional debe poder leer screenings reportables de su organización'
);
select pg_temp.assert_true(
  (select count(*) from public.screenings where organization_id = '10000000-0000-4000-8000-000000000002') = 0,
  'el profesional no debe leer screenings de otra organización'
);
select pg_temp.assert_true(
  (select count(*) from public.professional_reviews where organization_id = '10000000-0000-4000-8000-000000000002') = 0,
  'el profesional no debe leer revisiones de otra organización'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true(
  public.can_generate_professional_reports('10000000-0000-4000-8000-000000000002'),
  'el administrador de Clinica B debe poder generar reportes en su organización'
);
select pg_temp.assert_true(
  not public.can_generate_professional_reports('10000000-0000-4000-8000-000000000001'),
  'el administrador de Clinica B no debe generar reportes en Clinica A'
);
select pg_temp.assert_true(
  (select count(*) from public.patients where organization_id = '10000000-0000-4000-8000-000000000001') = 0,
  'el administrador de Clinica B no debe leer pacientes de Clinica A'
);
select pg_temp.assert_true(
  (select count(*) from public.patients where organization_id = '10000000-0000-4000-8000-000000000002') > 0,
  'el administrador de Clinica B debe leer sus fuentes de pacientes'
);

rollback;

\echo 'QA Supabase Fase 6: aislamiento de fuentes de reportes OK'
