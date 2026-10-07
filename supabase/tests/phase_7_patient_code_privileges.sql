-- Fase 7: la aplicación solo necesita USAGE para nextval().
-- SELECT/UPDATE permitirían leer el contador o ejecutar setval() desde un
-- cliente autenticado, alterando la generación y provocando colisiones.
-- Ejecutar después de aplicar la migración; no modifica filas.
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
  has_sequence_privilege('authenticated', 'public.patient_internal_identifier_sequence', 'USAGE')
  and has_sequence_privilege('authenticated', 'public.screening_medical_record_code_sequence', 'USAGE'),
  'authenticated debe poder consumir las secuencias para generar códigos'
);

select pg_temp.assert_true(
  not has_sequence_privilege('authenticated', 'public.patient_internal_identifier_sequence', 'SELECT')
  and not has_sequence_privilege('authenticated', 'public.patient_internal_identifier_sequence', 'UPDATE')
  and not has_sequence_privilege('authenticated', 'public.screening_medical_record_code_sequence', 'SELECT')
  and not has_sequence_privilege('authenticated', 'public.screening_medical_record_code_sequence', 'UPDATE'),
  'authenticated no debe leer ni alterar los contadores de códigos'
);

select pg_temp.assert_true(
  not has_sequence_privilege('anon', 'public.patient_internal_identifier_sequence', 'USAGE')
  and not has_sequence_privilege('anon', 'public.screening_medical_record_code_sequence', 'USAGE'),
  'anon no debe consumir ninguna secuencia de códigos'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.patients'::regclass
      and contype = 'u'
      and conname = 'patients_organization_id_internal_identifier_key'
  )
  and exists (
    select 1
    from pg_constraint
    where conrelid = 'public.screenings'::regclass
      and contype = 'u'
      and conname = 'screenings_organization_medical_record_code_key'
  ),
  'los códigos deben ser únicos dentro de cada tenant'
);

rollback;

\echo 'QA Supabase Fase 7: privilegios y unicidad de códigos OK'
