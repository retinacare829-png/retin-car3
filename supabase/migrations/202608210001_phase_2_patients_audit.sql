create type public.patient_sex as enum (
  'female',
  'male',
  'other',
  'unknown'
);

create type public.diabetes_type as enum (
  'type_1',
  'type_2',
  'gestational',
  'other',
  'unknown'
);

create type public.audit_action as enum (
  'patient.created',
  'patient.updated',
  'patient.archived',
  'patient.restored'
);

create type public.patient_timeline_event_type as enum (
  'patient.created',
  'patient.updated',
  'patient.archived',
  'patient.restored'
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  internal_identifier text not null,
  medical_record_code text not null,
  first_names text not null,
  last_names text not null,
  date_of_birth date not null,
  sex public.patient_sex not null default 'unknown',
  phone text,
  diabetes_diagnosis_date date,
  diabetes_type public.diabetes_type not null default 'unknown',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patients_internal_identifier_length check (char_length(trim(internal_identifier)) between 2 and 64),
  constraint patients_medical_record_code_length check (char_length(trim(medical_record_code)) between 2 and 64),
  constraint patients_first_names_length check (char_length(trim(first_names)) between 2 and 120),
  constraint patients_last_names_length check (char_length(trim(last_names)) between 2 and 120),
  constraint patients_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint patients_phone_length check (phone is null or char_length(phone) <= 32),
  constraint patients_birth_not_future check (date_of_birth <= current_date),
  constraint patients_diabetes_date_not_future check (
    diabetes_diagnosis_date is null or diabetes_diagnosis_date <= current_date
  ),
  constraint patients_diabetes_after_birth check (
    diabetes_diagnosis_date is null or diabetes_diagnosis_date >= date_of_birth
  ),
  unique (organization_id, internal_identifier),
  unique (organization_id, medical_record_code)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action public.audit_action not null,
  entity_type text not null,
  entity_id uuid not null,
  changed_fields text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_entity_type_length check (char_length(entity_type) between 2 and 80),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.patient_timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  event_type public.patient_timeline_event_type not null,
  title text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint patient_timeline_events_title_length check (char_length(trim(title)) between 2 and 160),
  constraint patient_timeline_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index patients_organization_active_idx on public.patients(organization_id, deleted_at);
create index patients_organization_last_names_idx on public.patients(organization_id, last_names);
create index patients_organization_created_at_idx on public.patients(organization_id, created_at desc);
create index audit_logs_organization_created_at_idx on public.audit_logs(organization_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index patient_timeline_events_patient_idx on public.patient_timeline_events(patient_id, created_at desc);

create trigger patients_set_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

alter table public.patients enable row level security;
alter table public.audit_logs enable row level security;
alter table public.patient_timeline_events enable row level security;

create policy "members can read patients in their organization"
on public.patients
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "authorized staff can create patients"
on public.patients
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  )
);

create policy "authorized staff can update patients"
on public.patients
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  )
)
with check (
  updated_by = auth.uid()
  and public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  )
);

create policy "members can read audit logs in their organization"
on public.audit_logs
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can create audit logs in their organization"
on public.audit_logs
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and public.is_org_member(organization_id)
);

create policy "members can read patient timeline in their organization"
on public.patient_timeline_events
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can create patient timeline events in their organization"
on public.patient_timeline_events
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and public.is_org_member(organization_id)
);
