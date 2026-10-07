-- Fase 8: códigos cortos por organización, primera visita atómica y teléfono.
-- Los códigos legacy permanecen intactos; los nuevos usan contadores privados
-- por organización y UPDATE ... RETURNING para evitar carreras max+1.
-- El formato usa padding mínimo de tres dígitos: después de 999 se expande a 1000.

create table public.organization_code_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  next_patient_number bigint not null default 1 check (next_patient_number > 0),
  next_screening_number bigint not null default 1 check (next_screening_number > 0)
);

alter table public.organization_code_counters enable row level security;
revoke all on table public.organization_code_counters from public, anon, authenticated;

insert into public.organization_code_counters (organization_id, next_patient_number, next_screening_number)
select organization.id,
  coalesce((
    select max(substring(patient.internal_identifier from '[0-9]{3}$')::bigint) + 1
    from public.patients patient
    where patient.organization_id = organization.id
      and patient.internal_identifier ~ '[0-9]{3}$'
      and patient.internal_identifier !~ '^RC-P-[0-9]{8}$'
  ), 1),
  coalesce((
    select greatest(
      coalesce((
        select max(substring(patient.medical_record_code from '[0-9]{3}$')::bigint)
        from public.patients patient
        where patient.organization_id = organization.id
          and patient.medical_record_code ~ '[0-9]{3}$'
          and patient.medical_record_code !~ '^EXP-[0-9]{8}$'
      ), 0),
      coalesce((
        select max(substring(screening.medical_record_code from '[0-9]{3}$')::bigint)
        from public.screenings screening
        where screening.organization_id = organization.id
          and screening.medical_record_code ~ '[0-9]{3}$'
          and screening.medical_record_code !~ '^EXP-[0-9]{8}$'
      ), 0)
    ) + 1
  ), 1)
from public.organizations organization
on conflict (organization_id) do nothing;

alter table public.patients
  add column creation_request_id uuid;

alter table public.patients
  add constraint patients_organization_creation_request_key
  unique (organization_id, creation_request_id);

comment on column public.patients.creation_request_id is
  'Idempotency key for a patient creation request; nullable for legacy rows.';

comment on column public.patients.phone is
  'New authenticated writes require eight digits or 00000000; unchanged legacy values remain valid.';

create or replace function public.assign_patient_and_screening_codes()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  code_number bigint;
  requester_id uuid := (select auth.uid());
begin
  if tg_table_name = 'patients' then
    if tg_op = 'INSERT' then
      -- Preserve bootstrap/seed rows that already carry a legacy identifier.
      if requester_id is null and new.internal_identifier is not null then
        insert into public.organization_code_counters (organization_id)
        values (new.organization_id)
        on conflict (organization_id) do nothing;

        if new.internal_identifier ~ '[0-9]{3}$'
          and new.internal_identifier !~ '^RC-P-[0-9]{8}$' then
          update public.organization_code_counters
          set next_patient_number = greatest(
            next_patient_number,
            substring(new.internal_identifier from '[0-9]{3}$')::bigint + 1
          )
          where organization_id = new.organization_id;
        end if;

        if new.medical_record_code is not null
          and new.medical_record_code ~ '[0-9]{3}$'
          and new.medical_record_code !~ '^EXP-[0-9]{8}$' then
          update public.organization_code_counters
          set next_screening_number = greatest(
            next_screening_number,
            substring(new.medical_record_code from '[0-9]{3}$')::bigint + 1
          )
          where organization_id = new.organization_id;
        end if;

        return new;
      end if;

      if new.phone is null or new.phone !~ '^[0-9]{8}$' then
        raise exception using
          errcode = 'check_violation',
          message = 'El telefono debe tener 8 digitos o ser 00000000.';
      end if;

      insert into public.organization_code_counters (organization_id)
      values (new.organization_id)
      on conflict (organization_id) do nothing;

      update public.organization_code_counters
      set next_patient_number = next_patient_number + 1
      where organization_id = new.organization_id
      returning next_patient_number - 1 into code_number;

      new.internal_identifier := case
        when code_number < 1000 then lpad(code_number::text, 3, '0')
        else code_number::text
      end;
      -- New expedientes belong to screenings, not to the patient row.
      new.medical_record_code := null;
    else
      new.organization_id := old.organization_id;
      new.internal_identifier := old.internal_identifier;
      new.medical_record_code := old.medical_record_code;
      new.creation_request_id := old.creation_request_id;

      if new.phone is distinct from old.phone
        and (new.phone is null or new.phone !~ '^[0-9]{8}$') then
        raise exception using
          errcode = 'check_violation',
          message = 'El telefono debe tener 8 digitos o ser 00000000.';
      end if;
    end if;
  elsif tg_table_name = 'screenings' then
    if tg_op = 'INSERT' then
      insert into public.organization_code_counters (organization_id)
      values (new.organization_id)
      on conflict (organization_id) do nothing;

      update public.organization_code_counters
      set next_screening_number = next_screening_number + 1
      where organization_id = new.organization_id
      returning next_screening_number - 1 into code_number;

      new.medical_record_code := case
        when code_number < 1000 then lpad(code_number::text, 3, '0')
        else code_number::text
      end;
    else
      new.organization_id := old.organization_id;
      new.patient_id := old.patient_id;
      new.medical_record_code := old.medical_record_code;
    end if;
  end if;

  return new;
end;
$$;

-- The trigger is SECURITY DEFINER only because the counter table is private;
-- callers cannot invoke it directly and it uses an empty search_path.
revoke all on function public.assign_patient_and_screening_codes() from public, anon, authenticated;

drop function public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text);

create function public.create_patient(
  target_organization_id uuid,
  target_first_names text,
  target_last_names text,
  target_date_of_birth date,
  target_sex public.patient_sex,
  target_phone text,
  target_diabetes_diagnosis_date date default null,
  target_diabetes_type public.diabetes_type default 'unknown',
  target_notes text default null,
  target_request_id uuid default null
)
returns public.patients
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  created_patient public.patients;
  first_screening_id uuid;
  actor_id uuid := (select auth.uid());
begin
  if target_request_id is not null then
    -- Serialize retries for the same organization/request before the lookup.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        target_organization_id::text || ':' || target_request_id::text,
        0
      )
    );
  end if;

  if target_request_id is not null then
    select patient.* into created_patient
    from public.patients patient
    where patient.organization_id = target_organization_id
      and patient.creation_request_id = target_request_id;
    if found then
      return created_patient;
    end if;
  end if;

  if target_request_id is null then
    insert into public.patients (
      organization_id, creation_request_id, first_names, last_names, date_of_birth, sex, phone,
      diabetes_diagnosis_date, diabetes_type, notes, created_by
    ) values (
      target_organization_id, null, target_first_names, target_last_names, target_date_of_birth,
      target_sex, target_phone, target_diabetes_diagnosis_date, target_diabetes_type,
      target_notes, actor_id
    )
    returning * into created_patient;
  else
    insert into public.patients (
      organization_id, creation_request_id, first_names, last_names, date_of_birth, sex, phone,
      diabetes_diagnosis_date, diabetes_type, notes, created_by
    ) values (
      target_organization_id, target_request_id, target_first_names, target_last_names, target_date_of_birth,
      target_sex, target_phone, target_diabetes_diagnosis_date, target_diabetes_type,
      target_notes, actor_id
    )
    on conflict (organization_id, creation_request_id) do nothing
    returning * into created_patient;

    if not found then
      select patient.* into created_patient
      from public.patients patient
      where patient.organization_id = target_organization_id
        and patient.creation_request_id = target_request_id;
      if not found then
        raise exception using errcode = 'serialization_failure', message = 'No se pudo resolver la solicitud idempotente.';
      end if;
      return created_patient;
    end if;
  end if;

  insert into public.screenings (organization_id, patient_id, status, created_by)
  values (created_patient.organization_id, created_patient.id, 'BORRADOR', actor_id)
  returning id into first_screening_id;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, changed_fields, metadata
  ) values
    (
      created_patient.organization_id, actor_id, 'patient.created', 'patient', created_patient.id,
      array['created']::text[], '{}'::jsonb
    ),
    (
      created_patient.organization_id, actor_id, 'screening.created', 'screening', first_screening_id,
      array['created']::text[], jsonb_build_object('patient_id', created_patient.id)
    );

  insert into public.patient_timeline_events (
    organization_id, patient_id, event_type, title, actor_user_id, metadata
  ) values
    (
      created_patient.organization_id, created_patient.id, 'patient.created', 'Paciente registrado', actor_id, '{}'::jsonb
    ),
    (
      created_patient.organization_id, created_patient.id, 'screening.created', 'Primera visita creada', actor_id,
      jsonb_build_object('screening_id', first_screening_id)
    );

  return created_patient;
end;
$$;

revoke all on function public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text, uuid) from public, anon;
grant execute on function public.create_patient(uuid, text, text, date, public.patient_sex, text, date, public.diabetes_type, text, uuid) to authenticated;

create or replace function public.preview_patient_codes(target_organization_id uuid)
returns table (internal_identifier text, record_code text, provisional boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_org_role(
    target_organization_id,
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  ) then
    raise exception using errcode = 'insufficient_privilege', message = 'No autorizado para previsualizar codigos.';
  end if;

  return query
  select case
      when coalesce(counter.next_patient_number, 1) < 1000
        then lpad(coalesce(counter.next_patient_number, 1)::text, 3, '0')
      else coalesce(counter.next_patient_number, 1)::text
    end,
    case
      when coalesce(counter.next_screening_number, 1) < 1000
        then lpad(coalesce(counter.next_screening_number, 1)::text, 3, '0')
      else coalesce(counter.next_screening_number, 1)::text
    end,
    true
  from public.organizations organization
  left join public.organization_code_counters counter
    on counter.organization_id = organization.id
  where organization.id = target_organization_id;
end;
$$;

revoke all on function public.preview_patient_codes(uuid) from public, anon;
grant execute on function public.preview_patient_codes(uuid) to authenticated;
