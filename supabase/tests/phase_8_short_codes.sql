-- QA transaccional Fase 8. Ejecutar después de la migración Fase 8.
-- No deja cambios persistentes.
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
  has_function_privilege(
    'authenticated',
    'public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text, uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text, uuid)',
    'EXECUTE'
  )
  and has_function_privilege('authenticated', 'public.preview_patient_codes(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.preview_patient_codes(uuid)', 'EXECUTE'),
  'solo authenticated debe ejecutar los RPC de Fase 8'
);

select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.assign_patient_and_screening_codes()', 'EXECUTE')
  and not has_table_privilege('authenticated', 'public.organization_code_counters', 'SELECT')
  and not has_table_privilege('authenticated', 'public.organization_code_counters', 'UPDATE'),
  'los contadores y su trigger deben permanecer privados'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);

select internal_identifier as preview_patient_code,
  record_code as preview_record_code,
  provisional as preview_is_provisional
from public.preview_patient_codes('10000000-0000-4000-8000-000000000001')
\gset

select pg_temp.assert_true(
  :'preview_patient_code' ~ '^[0-9]{3,}$'
  and :'preview_record_code' ~ '^[0-9]{3,}$'
  and :'preview_is_provisional' = 't',
  'la vista previa debe mostrar códigos cortos y marcarse provisional'
);

select internal_identifier as repeated_preview_patient_code,
  record_code as repeated_preview_record_code
from public.preview_patient_codes('10000000-0000-4000-8000-000000000001')
\gset
select pg_temp.assert_true(
  :'repeated_preview_patient_code' = :'preview_patient_code'
  and :'repeated_preview_record_code' = :'preview_record_code',
  'previsualizar no debe reservar ni consumir códigos'
);

select created.id as created_patient_id,
  created.internal_identifier as created_patient_code
from public.create_patient(
  '10000000-0000-4000-8000-000000000001',
  'Paciente', 'Fase Ocho', '1980-01-01', 'unknown', '81234567', null, 'unknown', null,
  '70000000-0000-4000-8000-000000000001'
) as created
\gset

select pg_temp.assert_true(
  :'created_patient_code' = :'preview_patient_code',
  'el paciente debe recibir el código provisional vigente al guardar'
);
select pg_temp.assert_true(
  (select count(*) = 1
   from public.screenings
   where patient_id = :'created_patient_id'
     and organization_id = '10000000-0000-4000-8000-000000000001')
  and (select medical_record_code = :'preview_record_code'
       from public.screenings
       where patient_id = :'created_patient_id'
         and organization_id = '10000000-0000-4000-8000-000000000001'),
  'guardar paciente debe crear la primera visita con el expediente previsualizado'
);
set local role postgres;
select pg_temp.assert_true(
  (select count(*) = 1 from public.audit_logs where entity_id = :'created_patient_id' and action = 'patient.created')
  and (select count(*) = 1 from public.audit_logs where entity_type = 'screening' and action = 'screening.created' and metadata ->> 'patient_id' = :'created_patient_id'),
  'paciente y primera visita deben auditarse'
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.patient_timeline_events where patient_id = :'created_patient_id'
    and event_type in ('patient.created', 'screening.created')),
  'paciente y primera visita deben aparecer en timeline'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);

-- Reintento con la misma clave: devuelve la misma ficha y no crea otra visita.
select created.id as retry_patient_id
from public.create_patient(
  '10000000-0000-4000-8000-000000000001',
  'Nombre Diferente', 'No Debe Duplicar', '1981-01-01', 'unknown', '81234567', null, 'unknown', null,
  '70000000-0000-4000-8000-000000000001'
) as created
\gset
select pg_temp.assert_true(
  :'retry_patient_id' = :'created_patient_id'
  and (select count(*) = 1 from public.screenings where patient_id = :'created_patient_id'),
  'el reintento idempotente no debe duplicar paciente ni visita'
);

select internal_identifier as after_retry_patient_code,
  record_code as after_retry_record_code
from public.preview_patient_codes('10000000-0000-4000-8000-000000000001')
\gset
select pg_temp.assert_true(
  :'after_retry_patient_code' <> :'preview_patient_code'
  and :'after_retry_record_code' <> :'preview_record_code',
  'los contadores deben avanzar una sola vez después de la creación'
);

-- Cada visita posterior conserva patient_id y recibe otro expediente.
insert into public.screenings (organization_id, patient_id, status, created_by)
values ('10000000-0000-4000-8000-000000000001', :'created_patient_id', 'BORRADOR', auth.uid());
select pg_temp.assert_true(
  (select count(distinct medical_record_code) = 2 from public.screenings where patient_id = :'created_patient_id')
  and (select bool_and(medical_record_code ~ '^[0-9]{3,}$') from public.screenings where patient_id = :'created_patient_id'),
  'cada visita posterior debe tener expediente corto distinto'
);

-- El padding es mínimo, no trunca ni recicla el código al superar 999.
set local role postgres;
update public.organization_code_counters
set next_patient_number = 1000, next_screening_number = 1000
where organization_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
select created.internal_identifier as four_digit_patient_code
from public.create_patient(
  '10000000-0000-4000-8000-000000000001',
  'Paciente', 'Sobre Mil', '1982-01-01', 'unknown', '81234569', null, 'unknown', null,
  '70000000-0000-4000-8000-000000000003'
) as created
\gset
select pg_temp.assert_true(
  :'four_digit_patient_code' = '1000'
  and (select count(*) = 1 from public.screenings where patient_id = (select id from public.patients where creation_request_id = '70000000-0000-4000-8000-000000000003') and medical_record_code = '1000'),
  'los códigos deben expandirse a 1000 sin truncarse'
);

-- El cliente no puede imponer el identificador; el trigger revocado se ejecuta igual.
insert into public.patients (
  id, organization_id, internal_identifier, first_names, last_names, date_of_birth, sex, phone, diabetes_type, created_by
) values (
  '29000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001',
  'CLIENT-OVERRIDE', 'Paciente', 'Trigger Ocho', '1981-01-01', 'unknown', '81234568', 'unknown', auth.uid()
);
select pg_temp.assert_true(
  (select internal_identifier <> 'CLIENT-OVERRIDE' and internal_identifier ~ '^[0-9]{3,}$'
   from public.patients where id = '29000000-0000-4000-8000-000000000008'),
  'el cliente no debe imponer el identificador corto'
);

do $$
begin
  begin
    perform public.create_patient(
      '10000000-0000-4000-8000-000000000001',
      'Paciente', 'Telefono Invalido', '1982-01-01', 'unknown', '1234', null, 'unknown', null,
      '70000000-0000-4000-8000-000000000002'
    );
    raise exception 'QA_ASSERTION_FAILED: telefono invalido aceptado';
  exception
    when check_violation then null;
  end;
end;
$$;

-- El valor legacy se conserva si no se modifica; cambiarlo exige formato nuevo.
update public.patients
set last_names = 'Legacy Conservado', updated_by = auth.uid()
where id = '20000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  (select phone = '+505 8888 0101' and last_names = 'Legacy Conservado'
   from public.patients where id = '20000000-0000-4000-8000-000000000001'),
  'la edición de otros campos no debe borrar teléfono legacy'
);

do $$
begin
  begin
    update public.patients set phone = '1234', updated_by = auth.uid()
    where id = '20000000-0000-4000-8000-000000000001';
    raise exception 'QA_ASSERTION_FAILED: edicion telefonica invalida aceptada';
  exception
    when check_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.screenings (organization_id, patient_id, status, created_by)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'BORRADOR', auth.uid());
    raise exception 'QA_ASSERTION_FAILED: screening cross-tenant aceptado';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
do $$
begin
  begin
    perform public.preview_patient_codes('10000000-0000-4000-8000-000000000001');
    raise exception 'QA_ASSERTION_FAILED: profesional previsualizo codigos';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);
do $$
begin
  begin
    perform public.preview_patient_codes('10000000-0000-4000-8000-000000000001');
    raise exception 'QA_ASSERTION_FAILED: suspendido previsualizo codigos';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.preview_patient_codes('10000000-0000-4000-8000-000000000001');
    raise exception 'QA_ASSERTION_FAILED: anon previsualizo codigos';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;

\echo 'QA Supabase Fase 8: códigos cortos, primera visita, idempotencia, teléfono y aislamiento OK'
