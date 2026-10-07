-- Fase 8: reintento idempotente sin consumo duplicado de contador.
-- El RPC serializa la misma organización/request_id antes de consultar o
-- insertar, por lo que un retry devuelve la ficha original sin avanzar la
-- preview nuevamente.
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

select internal_identifier, record_code
from public.preview_patient_codes('10000000-0000-4000-8000-000000000001')
\gset before_

select created.id, created.internal_identifier
from public.create_patient(
  '10000000-0000-4000-8000-000000000001',
  'Idempotente', 'Original', '1989-01-01', 'unknown', '00000000', null, 'unknown',
  null, '88000000-0000-4000-8000-000000000010'
) as created
\gset first_

select internal_identifier, record_code
from public.preview_patient_codes('10000000-0000-4000-8000-000000000001')
\gset after_first_

select duplicate.id
from public.create_patient(
  '10000000-0000-4000-8000-000000000001',
  'Idempotente', 'Reintento', '1990-01-01', 'female', '12345678', null, 'type_2',
  null, '88000000-0000-4000-8000-000000000010'
) as duplicate
\gset retry_

select internal_identifier, record_code
from public.preview_patient_codes('10000000-0000-4000-8000-000000000001')
\gset after_retry_

select pg_temp.assert_true(
  :'retry_id' = :'first_id'
  and :'after_retry_internal_identifier' = :'after_first_internal_identifier'
  and :'after_retry_record_code' = :'after_first_record_code',
  'un reintento idempotente no debe consumir otro número de paciente ni cambiar la preview'
);

rollback;

\echo 'QA Supabase Fase 8: idempotencia sin consumo duplicado OK'
