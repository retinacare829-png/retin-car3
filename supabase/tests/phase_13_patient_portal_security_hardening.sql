-- Fase 13 security hardening.
-- Ejecutar después de db reset en una base local Supabase configurada.

\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_hardening_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'QA_ASSERTION_FAILED: %', message;
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);

select pg_temp.assert_hardening_true(
  public.is_org_coordinator('10000000-0000-4000-8000-000000000001'::uuid),
  'el coordinador de Clínica A debe conservar el rol de owner'
);

do $$
begin
  begin
    insert into public.organization_members (organization_id, user_id, role, status)
    values (
      '10000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000006',
      'clinic_admin',
      'active'
    );
    raise exception 'QA_ASSERTION_FAILED: un coordinador pudo crear otro clinic_admin';
  exception when insufficient_privilege or check_violation then null;
  end;
end;
$$;

set local role postgres;
do $$
begin
  begin
    insert into public.patient_accounts (organization_id, patient_id, user_id, status, created_by)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '90000000-0000-4000-8000-000000000003',
      'active',
      '90000000-0000-4000-8000-000000000002'
    );
    raise exception 'QA_ASSERTION_FAILED: un miembro técnico pudo convertirse en paciente';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.patient_accounts (organization_id, patient_id, user_id, status, created_by)
values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000006',
  'active',
  '90000000-0000-4000-8000-000000000002'
);

-- A legacy suspended staff membership may coexist only while the patient
-- account is active; reactivating that membership must be rejected.
insert into public.patient_accounts (organization_id, patient_id, user_id, status, created_by)
values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000005',
  'active',
  '90000000-0000-4000-8000-000000000002'
);

do $$
begin
  begin
    update public.organization_members
    set status = 'active'
    where organization_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '90000000-0000-4000-8000-000000000005'
      and status = 'suspended';
    raise exception 'QA_ASSERTION_FAILED: una membresía suspendida pudo reactivarse junto a una cuenta paciente';
  exception when check_violation then null;
  end;
end;
$$;

-- A revoked patient account may exist beside staff, but revoked -> active
-- must be rejected when the user already has a clinical membership.
insert into public.patient_accounts (
  organization_id, patient_id, user_id, status, created_by, revoked_at, revoked_by
)
values (
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '90000000-0000-4000-8000-000000000003',
  'revoked',
  '90000000-0000-4000-8000-000000000002',
  now(),
  '90000000-0000-4000-8000-000000000002'
);

do $$
begin
  begin
    update public.patient_accounts
    set status = 'active'
    where organization_id = '10000000-0000-4000-8000-000000000002'
      and patient_id = '20000000-0000-4000-8000-000000000003';
    raise exception 'QA_ASSERTION_FAILED: una cuenta paciente revocada pudo reactivarse junto a personal clínico';
  exception when check_violation then null;
  end;
end;
$$;

select pg_temp.assert_hardening_true(
  (
    select pg_get_triggerdef(trg.oid) ilike '%UPDATE OF organization_id, user_id, role, status%'
    from pg_trigger trg
    join pg_class rel on rel.oid = trg.tgrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'organization_members'
      and trg.tgname = 'organization_members_enforce_coordinator_admin'
      and not trg.tgisinternal
  ),
  'la protección de clinic_admin debe cubrir también UPDATE status'
);

select pg_temp.assert_hardening_true(
  not exists (
    select 1
    from public.organization_members member
    where member.user_id = '90000000-0000-4000-8000-000000000006'
  ),
  'una cuenta paciente no debe tener membresía clínica'
);

select pg_temp.assert_hardening_true(
  exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.policyname = 'members can read private retinal images'
      and policy.qual::text like '%patient_accounts%'
  ),
  'Storage debe contener defensa explícita contra cuentas paciente'
);

do $$
begin
  begin
    insert into public.organization_members (organization_id, user_id, role, status)
    values (
      '10000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000006',
      'technical_staff',
      'active'
    );
    raise exception 'QA_ASSERTION_FAILED: una cuenta paciente pudo convertirse en miembro clínico';
  exception when check_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    update public.patient_accounts
    set user_id = '90000000-0000-4000-8000-000000000003'
    where user_id = '90000000-0000-4000-8000-000000000006';
    raise exception 'QA_ASSERTION_FAILED: una cuenta paciente pudo cambiar su identidad';
  exception when insufficient_privilege or check_violation then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000006', true);

select pg_temp.assert_hardening_true(
  (select count(*) from public.patients) = 0
  and (select count(*) from public.screenings) = 0
  and (select count(*) from public.retinal_images) = 0,
  'el usuario paciente no debe leer tablas clínicas directamente'
);

do $$
begin
  begin
    perform public.publish_screening_to_patient('30000000-0000-4000-8000-000000000004');
    raise exception 'QA_ASSERTION_FAILED: el paciente pudo publicar un informe';
  exception when invalid_parameter_value or insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
do $$
begin
  begin
    perform public.publish_screening_to_patient('30000000-0000-4000-8000-000000000004');
    raise exception 'QA_ASSERTION_FAILED: el técnico pudo publicar un informe';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role postgres;
select pg_temp.assert_hardening_true(
  pg_get_functiondef('public.close_screening_workflow(uuid, uuid, uuid)'::regprocedure)
    not like '%patient_published_at%',
  'cerrar screening no debe escribir campos de publicación paciente'
);

set local role anon;
do $$
begin
  begin
    perform public.get_patient_portal_snapshot();
    raise exception 'QA_ASSERTION_FAILED: anon pudo consultar el portal';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

\echo 'QA Fase 13 security hardening: separación patient/staff y coordinador único OK'
