-- QA Fase 6: autorización del RPC de reportes por rol, suspensión y tenant.
-- Ejecutar después de aplicar 202610060001_phase_6_report_access.sql.
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

set local role authenticated;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(
  not public.can_generate_professional_reports('10000000-0000-4000-8000-000000000001'),
  'technical_staff no debe generar reportes en su organización'
);
select pg_temp.assert_true(
  not public.can_generate_professional_reports('10000000-0000-4000-8000-000000000002'),
  'technical_staff no debe usar el RPC contra otro tenant'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true(
  not public.can_generate_professional_reports('10000000-0000-4000-8000-000000000001'),
  'una membresía suspendida no debe generar reportes'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(
  public.can_generate_professional_reports('10000000-0000-4000-8000-000000000001'),
  'authorized_professional debe generar reportes en su tenant'
);
select pg_temp.assert_true(
  not public.can_generate_professional_reports('10000000-0000-4000-8000-000000000002'),
  'authorized_professional no debe generar reportes cross-tenant'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true(
  public.can_generate_professional_reports('10000000-0000-4000-8000-000000000002'),
  'clinic_admin debe generar reportes en su tenant'
);
select pg_temp.assert_true(
  not public.can_generate_professional_reports('10000000-0000-4000-8000-000000000001'),
  'clinic_admin no debe generar reportes cross-tenant'
);

-- El revoke all del RPC debe impedir llamadas anónimas, aunque se conozca el UUID.
set local role anon;
select set_config('request.jwt.claim.sub', null, true);
do $$
begin
  begin
    perform public.can_generate_professional_reports('10000000-0000-4000-8000-000000000001');
    raise exception 'QA_ASSERTION_FAILED: anon pudo ejecutar el RPC de reportes';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

\echo 'QA Supabase Fase 6: autorización de reportes por rol OK'
