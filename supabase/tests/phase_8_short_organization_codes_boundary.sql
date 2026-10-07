-- Fase 8: transición de códigos 999 -> 1000.
-- El formato usa padding mínimo de tres dígitos y se expande sin truncar.
-- Todo el ejercicio revierte al final.
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

set local role postgres;
update public.organization_code_counters
set next_patient_number = 1000,
    next_screening_number = 1000
where organization_id = '10000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);

select created.id as patient_id, created.internal_identifier
from public.create_patient(
  '10000000-0000-4000-8000-000000000001',
  'Limite', 'Numerico', '1988-01-01', 'unknown', '00000000', null, 'unknown',
  null, '88000000-0000-4000-8000-000000000003'
) as created
\gset overflow_

select screening.medical_record_code
from public.screenings screening
where screening.patient_id = :'overflow_patient_id'
  and screening.organization_id = '10000000-0000-4000-8000-000000000001'
\gset overflow_

select pg_temp.assert_true(
  :'overflow_internal_identifier' = '1000'
  and :'overflow_medical_record_code' = '1000',
  'la secuencia debe continuar 999 -> 1000 sin truncar a 100'
);

rollback;

\echo 'QA Supabase Fase 8: transición 999 -> 1000 OK'
