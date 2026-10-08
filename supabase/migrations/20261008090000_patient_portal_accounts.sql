-- Portal de paciente: vínculo explícito de cuenta, publicación clínica y
-- superficie de lectura curada. Una cuenta de paciente nunca se agrega a
-- organization_members, porque esa tabla representa personal de la clínica.

create type public.patient_account_status as enum (
  'active',
  'suspended',
  'revoked'
);

alter table public.screenings
  add column patient_published_at timestamptz,
  add column patient_published_by uuid references auth.users(id) on delete set null,
  add constraint screenings_patient_publication_consistency check (
    (patient_published_at is null and patient_published_by is null)
    or (patient_published_at is not null and patient_published_by is not null)
  );

create index screenings_patient_published_idx
  on public.screenings(patient_id, patient_published_at desc)
  where patient_published_at is not null and deleted_at is null;

create table public.patient_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.patient_account_status not null default 'active',
  created_by uuid not null references auth.users(id) on delete restrict,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint patient_accounts_patient_tenant_fk
    foreign key (patient_id, organization_id)
    references public.patients(id, organization_id) on delete cascade,
  constraint patient_accounts_one_patient_account_key unique (patient_id),
  constraint patient_accounts_one_user_account_key unique (user_id),
  constraint patient_accounts_revocation_consistency check (
    (status in ('active', 'suspended') and revoked_at is null and revoked_by is null)
    or (status = 'revoked' and revoked_at is not null and revoked_by is not null)
  )
);

create index patient_accounts_organization_status_idx
  on public.patient_accounts(organization_id, status);
create index patient_accounts_user_status_idx
  on public.patient_accounts(user_id, status);

create trigger patient_accounts_set_updated_at
before update on public.patient_accounts
for each row execute function public.set_updated_at();

alter table public.patient_accounts enable row level security;
revoke all on table public.patient_accounts from public, anon;
grant select, insert, update on table public.patient_accounts to authenticated;

create or replace function public.is_patient_account_active(
  target_organization_id uuid,
  target_patient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.patient_accounts account
    where account.organization_id = target_organization_id
      and account.patient_id = target_patient_id
      and account.user_id = (select auth.uid())
      and account.status = 'active'
  );
$$;

revoke all on function public.is_patient_account_active(uuid, uuid) from public, anon;
grant execute on function public.is_patient_account_active(uuid, uuid) to authenticated;

create policy "patients can read their own portal account"
on public.patient_accounts for select to authenticated
using (user_id = (select auth.uid()));

create policy "clinic admins can read patient portal accounts"
on public.patient_accounts for select to authenticated
using (public.has_org_role(organization_id, array['clinic_admin']::public.organization_role[]));

create policy "clinic admins can create patient portal accounts"
on public.patient_accounts for insert to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'active'
  and public.has_org_role(organization_id, array['clinic_admin']::public.organization_role[])
  and exists (
    select 1
    from public.patients patient
    where patient.id = patient_accounts.patient_id
      and patient.organization_id = patient_accounts.organization_id
      and patient.deleted_at is null
  )
);

create policy "clinic admins can update patient portal accounts"
on public.patient_accounts for update to authenticated
using (public.has_org_role(organization_id, array['clinic_admin']::public.organization_role[]))
with check (
  public.has_org_role(organization_id, array['clinic_admin']::public.organization_role[])
  and (
    status <> 'active' or (
      status = 'active'
      and revoked_at is null
      and revoked_by is null
    )
  )
);

create or replace function public.protect_patient_account_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id
    or new.patient_id <> old.patient_id
    or new.user_id <> old.user_id
    or new.created_by <> old.created_by then
    raise exception using
      errcode = '42501',
      message = 'La identidad de una cuenta de paciente no puede cambiar.';
  end if;

  if old.status = 'revoked' and new.status <> old.status then
    raise exception using
      errcode = '42501',
      message = 'Una cuenta revocada no puede reactivarse.';
  end if;

  if new.status in ('active', 'suspended') then
    new.revoked_at := null;
    new.revoked_by := null;
  elsif old.status in ('active', 'suspended') then
    new.revoked_at := coalesce(new.revoked_at, pg_catalog.now());
    new.revoked_by := coalesce(new.revoked_by, (select auth.uid()));
  end if;

  return new;
end;
$$;

create trigger patient_accounts_protect_identity
before update on public.patient_accounts
for each row execute function public.protect_patient_account_identity();

create or replace function public.link_patient_account(
  target_organization_id uuid,
  target_patient_id uuid,
  target_user_id uuid
)
returns public.patient_accounts
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  linked_account public.patient_accounts;
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null
    or not public.has_org_role(
      target_organization_id,
      array['clinic_admin']::public.organization_role[]
    ) then
    raise exception using
      errcode = '42501',
      message = 'Solo un administrador activo puede vincular cuentas de pacientes.';
  end if;

  if target_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'La cuenta de paciente requiere un auth user id explícito.';
  end if;

  if not exists (
    select 1
    from public.patients patient
    where patient.id = target_patient_id
      and patient.organization_id = target_organization_id
      and patient.deleted_at is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'El paciente no pertenece a la clínica indicada o está archivado.';
  end if;

  insert into public.patient_accounts (
    organization_id, patient_id, user_id, status, created_by
  ) values (
    target_organization_id, target_patient_id, target_user_id, 'active', actor_id
  )
  returning * into linked_account;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, changed_fields, metadata
  ) values (
    target_organization_id,
    actor_id,
    'patient.updated',
    'patient_account',
    linked_account.id,
    array['account_linked']::text[],
    jsonb_build_object(
      'patient_id', target_patient_id,
      'auth_user_id', target_user_id
    )
  );

  return linked_account;
end;
$$;

revoke all on function public.link_patient_account(uuid, uuid, uuid) from public, anon;
grant execute on function public.link_patient_account(uuid, uuid, uuid) to authenticated;

create or replace function public.revoke_patient_account(
  target_organization_id uuid,
  target_patient_id uuid
)
returns public.patient_accounts
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  revoked_account public.patient_accounts;
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null
    or not public.has_org_role(
      target_organization_id,
      array['clinic_admin']::public.organization_role[]
    ) then
    raise exception using
      errcode = '42501',
      message = 'Solo un administrador activo puede revocar cuentas de pacientes.';
  end if;

  update public.patient_accounts
  set status = 'revoked', revoked_at = pg_catalog.now(), revoked_by = actor_id
  where organization_id = target_organization_id
    and patient_id = target_patient_id
    and status <> 'revoked'
  returning * into revoked_account;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'No existe una cuenta de paciente activa para revocar.';
  end if;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, changed_fields, metadata
  ) values (
    target_organization_id,
    actor_id,
    'patient.updated',
    'patient_account',
    revoked_account.id,
    array['account_revoked']::text[],
    jsonb_build_object(
      'patient_id', target_patient_id,
      'auth_user_id', revoked_account.user_id
    )
  );

  return revoked_account;
end;
$$;

revoke all on function public.revoke_patient_account(uuid, uuid) from public, anon;
grant execute on function public.revoke_patient_account(uuid, uuid) to authenticated;

create or replace function public.protect_patient_publication_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.patient_published_at is distinct from old.patient_published_at
    or new.patient_published_by is distinct from old.patient_published_by then
    if coalesce(
      pg_catalog.current_setting('retinacare.patient_portal_publish', true),
      'false'
    ) <> 'true' then
      raise exception using
        errcode = '42501',
        message = 'La publicación del portal debe ejecutarse mediante el RPC auditado.';
    end if;

    if new.patient_published_at is null or new.patient_published_by is null then
      raise exception using
        errcode = '42501',
        message = 'La publicación del portal no puede eliminarse.';
    end if;
  end if;

  return new;
end;
$$;

create trigger screenings_protect_patient_publication
before update on public.screenings
for each row execute function public.protect_patient_publication_fields();

create or replace function public.publish_screening_to_patient(target_screening_id uuid)
returns public.screenings
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  current_screening public.screenings;
  published_screening public.screenings;
  actor_id uuid := (select auth.uid());
begin
  select screening.* into current_screening
  from public.screenings screening
  where screening.id = target_screening_id;

  if not found then
    raise exception using errcode = '22023', message = 'El screening no existe.';
  end if;

  if actor_id is null
    or not public.has_org_role(
      current_screening.organization_id,
      array['clinic_admin', 'authorized_professional']::public.organization_role[]
    ) then
    raise exception using
      errcode = '42501',
      message = 'Solo un administrador o profesional autorizado puede publicar un reporte.';
  end if;

  if current_screening.status not in ('REVISADO', 'SEGUIMIENTO_REQUERIDO') then
    raise exception using
      errcode = 'check_violation',
      message = 'El screening debe estar aprobado antes de publicarse al paciente.';
  end if;

  if current_screening.patient_published_at is not null then
    return current_screening;
  end if;

  perform pg_catalog.set_config('retinacare.patient_portal_publish', 'true', true);

  update public.screenings
  set patient_published_at = pg_catalog.now(),
      patient_published_by = actor_id,
      updated_by = actor_id
  where id = target_screening_id
  returning * into published_screening;

  perform pg_catalog.set_config('retinacare.patient_portal_publish', 'false', true);

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, changed_fields, metadata
  ) values (
    published_screening.organization_id,
    actor_id,
    'screening.updated',
    'screening',
    published_screening.id,
    array['patient_published_at']::text[],
    jsonb_build_object('event', 'patient_report_published', 'patient_id', published_screening.patient_id)
  );

  insert into public.patient_timeline_events (
    organization_id, patient_id, event_type, title, actor_user_id, metadata
  ) values (
    published_screening.organization_id,
    published_screening.patient_id,
    'screening.updated',
    'Reporte aprobado para el portal del paciente',
    actor_id,
    jsonb_build_object('screening_id', published_screening.id)
  );

  return published_screening;
end;
$$;

revoke all on function public.publish_screening_to_patient(uuid) from public, anon;
grant execute on function public.publish_screening_to_patient(uuid) to authenticated;

create or replace function public.get_patient_portal_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  portal jsonb;
  screening_summary jsonb;
  report_payload jsonb;
  account public.patient_accounts;
  patient public.patients;
begin
  select linked.* into account
  from public.patient_accounts linked
  where linked.user_id = (select auth.uid())
    and linked.status = 'active';

  if not found then
    raise exception using
      errcode = '42501',
      message = 'La cuenta no tiene un portal de paciente activo.';
  end if;

  select record.* into patient
  from public.patients record
  where record.id = account.patient_id
    and record.organization_id = account.organization_id
    and record.deleted_at is null;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'El paciente vinculado no está disponible.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', screening.id,
        'recordCode', screening.medical_record_code,
        'status', screening.status,
        'publishedAt', screening.patient_published_at,
        'createdAt', screening.created_at,
        'closedAt', screening.closed_at
      ) order by screening.patient_published_at desc, screening.created_at desc
    ),
    '[]'::jsonb
  ) into screening_summary
  from public.screenings screening
  where screening.patient_id = patient.id
    and screening.organization_id = account.organization_id
    and screening.patient_published_at is not null
    and screening.status in ('REVISADO', 'SEGUIMIENTO_REQUERIDO', 'CERRADO')
    and screening.deleted_at is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'screeningId', screening.id,
        'recordCode', screening.medical_record_code,
        'status', screening.status,
        'publishedAt', screening.patient_published_at,
        'generalObservations', screening.general_observations,
        'professionalReview', (
          select jsonb_build_object(
            'status', review.review_status,
            'reviewedAt', review.reviewed_at,
            'structuredObservations', review.structured_observations,
            'notes', review.notes
          )
          from public.professional_reviews review
          where review.screening_id = screening.id
            and review.patient_id = patient.id
            and review.organization_id = account.organization_id
            and review.deleted_at is null
          order by review.created_at desc
          limit 1
        ),
        'followUps', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', follow_up.id,
                'type', follow_up.follow_up_type,
                'status', follow_up.follow_up_status,
                'dueDate', follow_up.due_date,
                'completedAt', follow_up.completed_at,
                'notes', follow_up.notes
              ) order by follow_up.created_at
            )
            from public.follow_ups follow_up
            where follow_up.screening_id = screening.id
              and follow_up.patient_id = patient.id
              and follow_up.organization_id = account.organization_id
              and follow_up.deleted_at is null
          ),
          '[]'::jsonb
        ),
        'referrals', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', referral.id,
                'reason', referral.referral_reason,
                'destination', referral.referral_destination,
                'status', referral.referral_status,
                'requestedDate', referral.requested_date,
                'completedDate', referral.completed_date,
                'notes', referral.notes
              ) order by referral.requested_date desc, referral.created_at desc
            )
            from public.referrals referral
            where referral.screening_id = screening.id
              and referral.patient_id = patient.id
              and referral.organization_id = account.organization_id
              and referral.deleted_at is null
          ),
          '[]'::jsonb
        ),
        'images', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', image.id,
                'laterality', image.laterality,
                'capturedAt', image.captured_at,
                    'mimeType', image.mime_type
              ) order by image.laterality
            )
            from public.retinal_images image
            where image.screening_id = screening.id
              and image.patient_id = patient.id
              and image.organization_id = account.organization_id
              and image.status = 'ACTIVA'
              and image.deleted_at is null
          ),
          '[]'::jsonb
        )
      ) order by screening.patient_published_at desc, screening.created_at desc
    ),
    '[]'::jsonb
  ) into report_payload
  from public.screenings screening
  where screening.patient_id = patient.id
    and screening.organization_id = account.organization_id
    and screening.patient_published_at is not null
    and screening.status in ('REVISADO', 'SEGUIMIENTO_REQUERIDO', 'CERRADO')
    and screening.deleted_at is null;

  select jsonb_build_object(
    'contractVersion', 1,
    'profile', jsonb_build_object(
      'id', patient.id,
      'internalIdentifier', patient.internal_identifier,
      'firstNames', patient.first_names,
      'lastNames', patient.last_names,
      'dateOfBirth', patient.date_of_birth,
      'sex', patient.sex,
      'phone', patient.phone
    ),
    'screenings', screening_summary,
    'reports', report_payload
  ) into portal;

  return portal;
end;
$$;

revoke all on function public.get_patient_portal_snapshot() from public, anon;
grant execute on function public.get_patient_portal_snapshot() to authenticated;

comment on table public.patient_accounts is
  'Explicit auth.users to patient link for the patient portal; never inferred from email or organization membership.';
comment on column public.screenings.patient_published_at is
  'Explicit professional approval timestamp for patient portal visibility; independent from screening closure.';
