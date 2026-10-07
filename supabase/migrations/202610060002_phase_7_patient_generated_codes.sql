-- Fase 7: identidad fija del paciente y expediente por visita/screening.
-- Se conserva patients.medical_record_code como dato histórico nullable;
-- el código operativo de cada visita vive en screenings.medical_record_code.

alter table public.patients
  alter column medical_record_code drop not null;

alter table public.screenings
  add column medical_record_code text;

create sequence public.patient_internal_identifier_sequence
  as bigint
  start with 1000000
  increment by 1
  minvalue 1;

create sequence public.screening_medical_record_code_sequence
  as bigint
  start with 1000000
  increment by 1
  minvalue 1;

revoke all on sequence public.patient_internal_identifier_sequence from public;
revoke all on sequence public.patient_internal_identifier_sequence from anon;
revoke all on sequence public.screening_medical_record_code_sequence from public;
revoke all on sequence public.screening_medical_record_code_sequence from anon;
grant usage on sequence public.patient_internal_identifier_sequence, public.screening_medical_record_code_sequence to authenticated, service_role;

-- Backfill existing visits before enforcing NOT NULL. Preserve a patient's
-- legacy expediente on its earliest visit when possible; later visits receive
-- a new database-generated code. Existing patient data is not deleted.
with first_screening as (
  select distinct on (screening.patient_id, screening.organization_id)
    screening.id,
    screening.organization_id,
    screening.patient_id
  from public.screenings screening
  where screening.medical_record_code is null
  order by screening.patient_id, screening.organization_id, screening.created_at, screening.id
)
update public.screenings screening
set medical_record_code = patient.medical_record_code
from first_screening first_visit
join public.patients patient
  on patient.id = first_visit.patient_id
 and patient.organization_id = first_visit.organization_id
where screening.id = first_visit.id
  and patient.medical_record_code is not null
  and not exists (
    select 1
    from public.screenings collision
    where collision.organization_id = screening.organization_id
      and collision.medical_record_code = patient.medical_record_code
  );

update public.screenings
set medical_record_code = 'EXP-' || lpad(nextval('public.screening_medical_record_code_sequence')::text, 8, '0')
where medical_record_code is null;

alter table public.screenings
  alter column medical_record_code set not null,
  add constraint screenings_medical_record_code_length check (char_length(trim(medical_record_code)) between 2 and 64),
  add constraint screenings_organization_medical_record_code_key unique (organization_id, medical_record_code);

create or replace function public.assign_patient_and_screening_codes()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  code_number bigint;
begin
  if tg_table_name = 'patients' then
    if tg_op = 'INSERT' then
      if (select auth.uid()) is not null or new.internal_identifier is null then
        code_number := nextval('public.patient_internal_identifier_sequence');
        new.internal_identifier := 'RC-P-' || lpad(code_number::text, 8, '0');
        -- New writes no longer use the patient-level legacy expediente code.
        new.medical_record_code := null;
      end if;
    else
      new.organization_id := old.organization_id;
      new.internal_identifier := old.internal_identifier;
      new.medical_record_code := old.medical_record_code;
    end if;
  elsif tg_table_name = 'screenings' then
    if tg_op = 'INSERT' then
      code_number := nextval('public.screening_medical_record_code_sequence');
      new.medical_record_code := 'EXP-' || lpad(code_number::text, 8, '0');
    else
      new.organization_id := old.organization_id;
      new.patient_id := old.patient_id;
      new.medical_record_code := old.medical_record_code;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists patients_assign_codes on public.patients;
create trigger patients_assign_codes
before insert or update on public.patients
for each row execute function public.assign_patient_and_screening_codes();

drop trigger if exists screenings_assign_medical_record_code on public.screenings;
create trigger screenings_assign_medical_record_code
before insert or update on public.screenings
for each row execute function public.assign_patient_and_screening_codes();

-- Atomic patient creation: the patient, audit row and timeline event commit or
-- roll back together. The first visit remains an explicit screening action.
create or replace function public.create_patient(
  target_organization_id uuid,
  target_first_names text,
  target_last_names text,
  target_date_of_birth date,
  target_sex public.patient_sex,
  target_phone text default null,
  target_diabetes_diagnosis_date date default null,
  target_diabetes_type public.diabetes_type default 'unknown',
  target_notes text default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  created_patient_id uuid;
  actor_id uuid := (select auth.uid());
begin
  insert into public.patients (
    organization_id, first_names, last_names, date_of_birth, sex, phone,
    diabetes_diagnosis_date, diabetes_type, notes, created_by
  ) values (
    target_organization_id, target_first_names, target_last_names, target_date_of_birth,
    target_sex, target_phone, target_diabetes_diagnosis_date, target_diabetes_type,
    target_notes, actor_id
  )
  returning id into created_patient_id;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, changed_fields, metadata
  ) values (
    target_organization_id, actor_id, 'patient.created', 'patient', created_patient_id,
    array['created']::text[], '{}'::jsonb
  );

  insert into public.patient_timeline_events (
    organization_id, patient_id, event_type, title, actor_user_id, metadata
  ) values (
    target_organization_id, created_patient_id, 'patient.created', 'Paciente registrado', actor_id, '{}'::jsonb
  );

  return created_patient_id;
end;
$$;

revoke all on function public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text) from public;
revoke all on function public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text) from anon;
grant execute on function public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text) to authenticated;
