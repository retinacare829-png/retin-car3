-- Fase 8: regresiones de diseño conocidas, ejecutables de forma aislada.
-- Estas pruebas documentan expectativas que deben decidirse/corregirse antes
-- de cerrar la migración; no deben confundirse con un resultado verde.
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

-- La migración declara códigos de tres dígitos, pero no impone un máximo.
-- Este bloque debe fallar hasta que se defina rollover/rechazo explícito.
set local role postgres;
update public.organization_code_counters
set next_patient_number = 1000,
    next_screening_number = 1000
where organization_id = '10000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);

select created.internal_identifier, screening.medical_record_code
from public.create_patient(
  '10000000-0000-4000-8000-000000000001',
  'Limite', 'Numerico', '1988-01-01', 'unknown', '00000000', null, 'unknown',
  null, '88000000-0000-4000-8000-000000000003'
) as created
join public.screenings screening
  on screening.patient_id = created.id
 and screening.organization_id = created.organization_id
\gset overflow_

select pg_temp.assert_true(
  :'overflow_internal_identifier' ~ '^[0-9]{3}$'
  and :'overflow_medical_record_code' ~ '^[0-9]{3}$',
  'los códigos cortos deben conservar tres dígitos al alcanzar 999'
);

rollback;

\echo 'QA Supabase Fase 8: límite de tres dígitos OK'
