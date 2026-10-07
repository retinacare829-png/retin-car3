-- Fase 7 follow-up: return the generated patient row from the atomic RPC.
-- This avoids a second read after a committed creation.

drop function public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text);

create function public.create_patient(
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
returns public.patients
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  created_patient public.patients;
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
  returning * into created_patient;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, changed_fields, metadata
  ) values (
    created_patient.organization_id, actor_id, 'patient.created', 'patient', created_patient.id,
    array['created']::text[], '{}'::jsonb
  );

  insert into public.patient_timeline_events (
    organization_id, patient_id, event_type, title, actor_user_id, metadata
  ) values (
    created_patient.organization_id, created_patient.id, 'patient.created', 'Paciente registrado', actor_id, '{}'::jsonb
  );

  return created_patient;
end;
$$;

revoke all on function public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text) from public;
revoke all on function public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text) from anon;
grant execute on function public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text) to authenticated;
