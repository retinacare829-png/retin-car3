-- Fase 13: cuenta de paciente, publicación explícita y aislamiento del portal.
-- Todo el ejercicio es transaccional y revierte al final.

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
    select 1 from pg_constraint
    where conrelid = 'public.patient_accounts'::regclass
      and conname = 'patient_accounts_patient_tenant_fk'
  )
  and exists (
    select 1 from pg_constraint
    where conrelid = 'public.patient_accounts'::regclass
      and conname = 'patient_accounts_one_user_account_key'
  ),
  'el vínculo de cuenta debe tener FK tenant y unicidad por auth user'
);

select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.link_patient_account(uuid, uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.link_patient_account(uuid, uuid, uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_patient_portal_snapshot()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_patient_portal_snapshot()', 'EXECUTE'),
  'los RPC de vínculo y portal deben ser solo para authenticated'
);

select pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.patient_accounts', 'SELECT')
  and not has_table_privilege('anon', 'public.patient_accounts', 'SELECT'),
  'la tabla de vínculos no debe estar disponible para anon'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);

do $$
begin
  begin
    perform public.link_patient_account(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000005'
    );
    raise exception 'QA_ASSERTION_FAILED: un usuario no admin pudo vincular una cuenta';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);

select linked.id, linked.user_id
from public.link_patient_account(
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '90000000-0000-4000-8000-000000000005'
) linked
\gset linked_

select pg_temp.assert_true(
  :'linked_user_id' = '90000000-0000-4000-8000-000000000005'
  and exists (
    select 1 from public.patient_accounts
    where id = :'linked_id' and status = 'active'
  ),
  'el administrador debe vincular explícitamente el auth user indicado'
);

select pg_temp.assert_true(
  (select count(*) from public.patient_accounts where user_id = '90000000-0000-4000-8000-000000000005') = 1,
  'la cuenta debe tener un solo vínculo'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);

select pg_temp.assert_true(
  (select count(*) from public.patients) = 0
  and (select count(*) from public.screenings) = 0
  and (select count(*) from public.retinal_images) = 0,
  'el paciente no debe leer tablas clínicas directamente'
);

select pg_temp.assert_true(
  (public.get_patient_portal_snapshot() ->> 'contractVersion') = '1'
  and jsonb_array_length(public.get_patient_portal_snapshot() -> 'screenings') = 0
  and jsonb_array_length(public.get_patient_portal_snapshot() -> 'reports') = 0,
  'el portal debe devolver contrato válido sin screenings publicados'
);

set local role postgres;
insert into public.screenings (
  id, organization_id, patient_id, status, created_by,
  patient_published_at, patient_published_by, patient_report_summary
) values (
  '33000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  'REVISADO',
  '90000000-0000-4000-8000-000000000004',
  now(),
  '90000000-0000-4000-8000-000000000004',
  'Resumen aprobado de prueba'
);
insert into public.screenings (
  id, organization_id, patient_id, status, created_by, general_observations
) values (
  '33000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  'REVISADO',
  '90000000-0000-4000-8000-000000000004',
  'Texto aprobado por el profesional'
);
insert into public.screenings (
  id, organization_id, patient_id, status, created_by
) values (
  '33000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  'PENDIENTE_REVISION',
  '90000000-0000-4000-8000-000000000004'
);

insert into public.professional_reviews (
  organization_id, patient_id, screening_id, reviewer_user_id, review_status, reviewed_at
) values (
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '33000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000004',
  'REVISION_COMPLETADA', now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);

select pg_temp.assert_true(
  (select count(*) from public.screenings) = 0,
  'el paciente no debe leer screenings directamente'
);

select pg_temp.assert_true(
  (public.get_patient_portal_snapshot() -> 'screenings' -> 0 ->> 'id') = '33000000-0000-4000-8000-000000000001'
  and (public.get_patient_portal_snapshot() -> 'screenings' -> 0 ->> 'status') = 'REVISADO'
  and (public.get_patient_portal_snapshot() -> 'screenings' -> 0 ->> 'statusLabel') = 'Revisado'
  and (public.get_patient_portal_snapshot() -> 'profile' ->> 'organizationName') = 'Centro Demo Diabetes'
  and (public.get_patient_portal_snapshot() -> 'reports' -> 0 ->> 'screeningId') = '33000000-0000-4000-8000-000000000001'
  and (public.get_patient_portal_snapshot() -> 'reports' -> 0 ? 'summary')
  and not (public.get_patient_portal_snapshot() -> 'reports' -> 0 ? 'professionalReview')
  and not (public.get_patient_portal_snapshot() -> 'reports' -> 0 ? 'images'),
  'el RPC debe devolver solo el contrato publicado sin notas internas ni imagenes'
);

set local role postgres;
select pg_temp.assert_true(
  (select count(*) from public.audit_logs
   where entity_type = 'patient_account'
     and entity_id = :'linked_id'
     and changed_fields @> array['account_linked']) = 1,
  'el vínculo debe dejar auditoría sin usar email como identidad'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);

do $$
begin
  begin
    perform public.publish_screening_to_patient('33000000-0000-4000-8000-000000000002');
    raise exception 'QA_ASSERTION_FAILED: se publico sin revision profesional';
  exception when check_violation then null;
  end;
end;
$$;

set local role postgres;
insert into public.professional_reviews (
  organization_id, patient_id, screening_id, reviewer_user_id, review_status, reviewed_at
) values (
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '33000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000004',
  'REVISION_COMPLETADA', now()
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);

select published.id
from public.publish_screening_to_patient('33000000-0000-4000-8000-000000000002') published
\gset published_

select pg_temp.assert_true(
  (select patient_published_at is not null from public.screenings where id = :'published_id'),
  'la publicación debe quedar separada del estado cerrado'
);

update public.screenings
set general_observations = 'Cambio posterior no aprobado'
where id = :'published_id';

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(public.get_patient_portal_snapshot() -> 'reports') report
    where report ->> 'screeningId' = :'published_id'
      and report ->> 'summary' = 'Texto aprobado por el profesional'
  ),
  'el resumen publicado debe permanecer congelado tras editar observaciones internas'
);
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);

do $$
begin
  begin
    update public.screenings
    set patient_published_at = now(),
        patient_published_by = (select auth.uid()),
        updated_by = (select auth.uid())
    where id = '33000000-0000-4000-8000-000000000003';
    raise exception 'QA_ASSERTION_FAILED: un update directo pudo publicar un screening';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
begin
  begin
    perform public.publish_screening_to_patient('33000000-0000-4000-8000-000000000003');
    raise exception 'QA_ASSERTION_FAILED: un screening preliminar pudo publicarse';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true(
  jsonb_array_length(public.get_patient_portal_snapshot() -> 'screenings') = 2,
  'la cuenta paciente debe ver ambos screenings publicados solo por el snapshot'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
select public.revoke_patient_account(
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true(
  (select count(*) from public.patients) = 0,
  'una cuenta revocada no debe leer el paciente vinculado'
);

do $$
begin
  begin
    perform public.get_patient_portal_snapshot();
    raise exception 'QA_ASSERTION_FAILED: una cuenta revocada pudo consultar el portal';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

\echo 'QA Supabase Fase 13: vínculo explícito, publicación y aislamiento del portal OK'
