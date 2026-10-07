-- Fase 7: código fijo de paciente y expediente nuevo por visita/screening.
-- Ejecutar después de aplicar la migración; todo revierte al final.
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
  has_function_privilege('authenticated', 'public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text)', 'EXECUTE'),
  'solo authenticated debe ejecutar el RPC de creación'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);

select created.id as rpc_patient_id,
  created.internal_identifier as rpc_internal_identifier,
  coalesce(created.medical_record_code, '<NULL>') as rpc_medical_record_code
from public.create_patient(
  '10000000-0000-4000-8000-000000000001',
  'Paciente', 'RPC', '1980-01-01', 'unknown', null, null, 'unknown', null
) as created \gset

select pg_temp.assert_true(
  :'rpc_internal_identifier' ~ '^RC-P-[0-9]+$' and :'rpc_medical_record_code' = '<NULL>',
  'el RPC debe devolver los códigos generados en la misma respuesta'
);

select pg_temp.assert_true(
  (select internal_identifier ~ '^RC-P-[0-9]+$' and medical_record_code is null
   from public.patients where id = :'rpc_patient_id'),
  'el RPC debe generar el código fijo del paciente y no un expediente de visita'
);
select pg_temp.assert_true(
  has_sequence_privilege('authenticated', 'public.patient_internal_identifier_sequence', 'USAGE')
  and has_sequence_privilege('authenticated', 'public.screening_medical_record_code_sequence', 'USAGE')
  and not has_sequence_privilege('authenticated', 'public.patient_internal_identifier_sequence', 'SELECT')
  and not has_sequence_privilege('authenticated', 'public.patient_internal_identifier_sequence', 'UPDATE')
  and not has_sequence_privilege('authenticated', 'public.screening_medical_record_code_sequence', 'SELECT')
  and not has_sequence_privilege('authenticated', 'public.screening_medical_record_code_sequence', 'UPDATE')
  and not has_sequence_privilege('anon', 'public.patient_internal_identifier_sequence', 'USAGE')
  and not has_sequence_privilege('anon', 'public.patient_internal_identifier_sequence', 'SELECT')
  and not has_sequence_privilege('anon', 'public.patient_internal_identifier_sequence', 'UPDATE')
  and not has_sequence_privilege('anon', 'public.screening_medical_record_code_sequence', 'USAGE')
  and not has_sequence_privilege('anon', 'public.screening_medical_record_code_sequence', 'SELECT')
  and not has_sequence_privilege('anon', 'public.screening_medical_record_code_sequence', 'UPDATE'),
  'authenticated debe tener USAGE de las secuencias y anon no'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.patient_timeline_events where patient_id = :'rpc_patient_id' and event_type = 'patient.created'),
  'la creación debe registrar timeline atómicamente'
);
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.audit_logs where entity_id = :'rpc_patient_id' and action = 'patient.created'),
  'la creación debe registrar auditoría atómicamente'
);

update public.patients
set internal_identifier = 'CLIENT-OVERRIDE', medical_record_code = 'CLIENT-LEGACY', updated_by = auth.uid()
where id = :'rpc_patient_id';
select pg_temp.assert_true(
  (select internal_identifier !~ '^CLIENT-' and medical_record_code is null from public.patients where id = :'rpc_patient_id'),
  'el cliente no debe sustituir el código fijo existente'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
insert into public.patients (
  id, organization_id, internal_identifier, medical_record_code, first_names, last_names,
  date_of_birth, sex, diabetes_type, created_by
) values (
  '29000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'CLIENT-INSERT', 'CLIENT-INSERT', 'Paciente', 'Trigger', '1981-01-01', 'unknown', 'unknown',
  '90000000-0000-4000-8000-000000000003'
);
select pg_temp.assert_true(
  (select internal_identifier ~ '^RC-P-[0-9]+$' and medical_record_code is null
   from public.patients where id = '29000000-0000-4000-8000-000000000002'),
  'un cliente no debe sustituir el código al insertar paciente'
);

insert into public.screenings (id, organization_id, patient_id, status, created_by)
values ('39000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', :'rpc_patient_id', 'BORRADOR', auth.uid());
insert into public.screenings (id, organization_id, patient_id, status, created_by)
values ('39000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', :'rpc_patient_id', 'BORRADOR', auth.uid());
select pg_temp.assert_true(
  (select count(distinct medical_record_code) = 2
   from public.screenings where patient_id = :'rpc_patient_id' and id in ('39000000-0000-4000-8000-000000000001', '39000000-0000-4000-8000-000000000002'))
  and (select bool_and(medical_record_code ~ '^EXP-[0-9]+$')
       from public.screenings where patient_id = :'rpc_patient_id' and id in ('39000000-0000-4000-8000-000000000001', '39000000-0000-4000-8000-000000000002')),
  'cada screening debe recibir un expediente nuevo y único'
);

update public.screenings
set medical_record_code = 'CLIENT-VISIT-OVERRIDE', updated_by = auth.uid()
where id = '39000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  (select medical_record_code !~ '^CLIENT-' from public.screenings where id = '39000000-0000-4000-8000-000000000001'),
  'el código de expediente debe conservarse al editar la visita'
);

-- Incluso con membresía temporal en ambos tenants, el trigger no permite
-- reasignar el paciente a otra organización.
set local role postgres;
insert into public.organization_members (organization_id, user_id, role, status)
values ('10000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002', 'clinic_admin', 'active');
set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
update public.patients
set organization_id = '10000000-0000-4000-8000-000000000002', updated_by = auth.uid()
where id = :'rpc_patient_id';
select pg_temp.assert_true(
  (select organization_id = '10000000-0000-4000-8000-000000000001' from public.patients where id = :'rpc_patient_id'),
  'el paciente no debe poder cruzar de organización al editar'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
do $$
begin
  begin
    perform public.create_patient(
      '10000000-0000-4000-8000-000000000001',
      'No', 'Autorizado', '1982-01-01', 'unknown', null, null, 'unknown', null
    );
    raise exception 'QA_ASSERTION_FAILED: authorized_professional creo paciente';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);
do $$
begin
  begin
    perform public.create_patient(
      '10000000-0000-4000-8000-000000000001',
      'Suspendido', 'Demo', '1983-01-01', 'unknown', null, null, 'unknown', null
    );
    raise exception 'QA_ASSERTION_FAILED: usuario suspendido creo paciente';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.create_patient(
      '10000000-0000-4000-8000-000000000001',
      'Anonimo', 'Demo', '1984-01-01', 'unknown', null, null, 'unknown', null
    );
    raise exception 'QA_ASSERTION_FAILED: anon ejecuto create_patient';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;

\echo 'QA Supabase Fase 7: códigos de paciente/visita y creación atómica OK'
