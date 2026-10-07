-- Fase 8: superficie de seguridad y comportamiento transaccional.
-- Ejecutar después de 202610070001_phase_8_short_organization_codes.sql
-- sobre el fixture QA existente. Todo el ejercicio revierte al final.
-- No valida concurrencia real entre sesiones; esa parte debe ejecutarse con
-- dos conexiones concurrentes o pgbench.
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
  (select relrowsecurity from pg_class where oid = 'public.organization_code_counters'::regclass),
  'el contador por organización debe tener RLS habilitado'
);

select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.organization_code_counters', 'SELECT')
  and not has_table_privilege('authenticated', 'public.organization_code_counters', 'INSERT')
  and not has_table_privilege('authenticated', 'public.organization_code_counters', 'UPDATE')
  and not has_table_privilege('anon', 'public.organization_code_counters', 'SELECT'),
  'los clientes no deben acceder directamente al contador por organización'
);

select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text, uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.preview_patient_codes(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.preview_patient_codes(uuid)', 'EXECUTE'),
  'solo authenticated debe ejecutar los RPC de Fase 8'
);

select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.assign_patient_and_screening_codes()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.assign_patient_and_screening_codes()', 'EXECUTE'),
  'el trigger SECURITY DEFINER no debe quedar invocable por clientes'
);

select pg_temp.assert_true(
  not has_sequence_privilege('authenticated', 'public.patient_internal_identifier_sequence', 'SELECT')
  and not has_sequence_privilege('authenticated', 'public.patient_internal_identifier_sequence', 'UPDATE')
  and not has_sequence_privilege('authenticated', 'public.screening_medical_record_code_sequence', 'SELECT')
  and not has_sequence_privilege('authenticated', 'public.screening_medical_record_code_sequence', 'UPDATE')
  and not has_sequence_privilege('anon', 'public.patient_internal_identifier_sequence', 'USAGE')
  and not has_sequence_privilege('anon', 'public.screening_medical_record_code_sequence', 'USAGE'),
  'las secuencias legacy deben seguir protegidas contra lectura y setval directo'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_proc
    where oid = 'public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text, uuid)'::regprocedure
      and prosecdef
  )
  and exists (
    select 1
    from pg_proc
    where oid = 'public.preview_patient_codes(uuid)'::regprocedure
      and prosecdef
  ),
  'create_patient debe respetar RLS y preview debe proteger solo la lectura del contador'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.patients'::regclass
      and conname = 'patients_organization_creation_request_key'
      and contype = 'u'
  )
  and exists (
    select 1
    from pg_constraint
    where conrelid = 'public.screenings'::regclass
      and conname = 'screenings_patient_tenant_fk'
      and contype = 'f'
  ),
  'la idempotencia y la relación paciente-screening deben conservar aislamiento tenant'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);

select internal_identifier, record_code
from public.preview_patient_codes('10000000-0000-4000-8000-000000000001')
\gset preview_before_

select internal_identifier, record_code
from public.preview_patient_codes('10000000-0000-4000-8000-000000000001')
\gset preview_repeat_

select pg_temp.assert_true(
  :'preview_repeat_internal_identifier' = :'preview_before_internal_identifier'
  and :'preview_repeat_record_code' = :'preview_before_record_code',
  'preview no debe consumir ni incrementar contadores'
);

select created.id,
  created.internal_identifier,
  coalesce(created.medical_record_code, '<NULL>') as medical_record_code,
  created.phone
from public.create_patient(
  '10000000-0000-4000-8000-000000000001',
  'Fase', 'Ocho', '1986-01-01', 'unknown', '00000000', null, 'unknown',
  'QA Fase 8', '88000000-0000-4000-8000-000000000001'
) as created
\gset created_

select pg_temp.assert_true(
  :'created_phone' = '00000000'
  and :'created_internal_identifier' ~ '^[0-9]{3}$'
  and :'created_medical_record_code' = '<NULL>',
  'create_patient debe aceptar el sentinel y devolver el código de paciente corto'
);

select pg_temp.assert_true(
  (select count(*) = 1
   from public.screenings
   where patient_id = :'created_id'
     and organization_id = '10000000-0000-4000-8000-000000000001'),
  'create_patient debe crear exactamente la primera visita en el mismo tenant'
);

select pg_temp.assert_true(
  (select count(*) = 1
   from public.audit_logs
   where entity_id = :'created_id'
     and action = 'patient.created')
  and (select count(*) = 1
       from public.audit_logs
       where entity_id = :'created_id'
         and action = 'screening.created'),
  'paciente y primera visita deben dejar auditoría atómica'
);

select internal_identifier, record_code
from public.preview_patient_codes('10000000-0000-4000-8000-000000000001')
\gset preview_after_

select pg_temp.assert_true(
  :'preview_after_internal_identifier'::bigint = :'preview_before_internal_identifier'::bigint + 1
  and :'preview_after_record_code'::bigint = :'preview_before_record_code'::bigint + 1,
  'la preview debe reflejar el siguiente número después de paciente y primera visita'
);

select duplicate.id, duplicate.internal_identifier
from public.create_patient(
  '10000000-0000-4000-8000-000000000001',
  'Datos', 'Distintos', '1990-01-01', 'female', '12345678', null, 'type_2',
  'reintento', '88000000-0000-4000-8000-000000000001'
) as duplicate
\gset duplicate_

select pg_temp.assert_true(
  :'duplicate_id' = :'created_id'
  and (select count(*) = 1 from public.screenings where patient_id = :'created_id')
  and (select phone = '00000000' from public.patients where id = :'created_id'),
  'repetir la misma request_id debe devolver la creación original sin duplicar visita'
);

do $$
begin
  begin
    perform public.create_patient(
      '10000000-0000-4000-8000-000000000001',
      'Telefono', 'Invalido', '1987-01-01', 'unknown', null, null, 'unknown',
      null, '88000000-0000-4000-8000-000000000002'
    );
    raise exception 'QA_ASSERTION_FAILED: se aceptó teléfono nulo en alta nueva';
  exception when check_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    perform public.create_patient(
      '10000000-0000-4000-8000-000000000002',
      'Tenant', 'Incorrecto', '1987-01-01', 'unknown', '12345678', null, 'unknown',
      null, '88000000-0000-4000-8000-000000000004'
    );
    raise exception 'QA_ASSERTION_FAILED: se permitió create_patient cross-tenant';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select pg_temp.assert_true(
  not public.has_org_role(
    '10000000-0000-4000-8000-000000000002',
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  ),
  'el técnico de Clínica A no debe tener rol de escritura en Clínica B'
);

do $$
begin
  begin
    perform public.preview_patient_codes('10000000-0000-4000-8000-000000000002');
    raise exception 'QA_ASSERTION_FAILED: se permitió preview cross-tenant';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

\echo 'QA Supabase Fase 8: ACL, RLS, preview, sentinel e idempotencia OK'
