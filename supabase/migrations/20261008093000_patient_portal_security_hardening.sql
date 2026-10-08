-- Security hardening for the patient portal.
-- Patient accounts are a separate identity boundary from clinic staff. A user
-- with an active/suspended patient account must never also be a clinic member.

with coordinator_candidates as (
  select distinct on (member.organization_id)
    member.organization_id,
    member.user_id
  from public.organization_members member
  where member.role = 'clinic_admin'
    and member.status = 'active'
  order by member.organization_id, member.created_at, member.id
)
update public.organizations organization
set created_by = candidate.user_id
from coordinator_candidates candidate
where organization.id = candidate.organization_id
  and organization.created_by is null;

create or replace function public.is_org_coordinator(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organizations organization
    join public.organization_members member
      on member.organization_id = organization.id
     and member.user_id = (select auth.uid())
     and member.role = 'clinic_admin'
     and member.status = 'active'
    where organization.id = target_organization_id
      and organization.created_by = (select auth.uid())
  );
$$;

revoke all on function public.is_org_coordinator(uuid) from public, anon;
grant execute on function public.is_org_coordinator(uuid) to authenticated;

create or replace function public.prevent_patient_clinical_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'patient_accounts' then
    if new.status in ('active', 'suspended') and exists (
      select 1
      from public.organization_members member
      where member.user_id = new.user_id
        and member.status in ('active', 'invited')
    ) then
      raise exception using
        errcode = '23514',
        message = 'Una cuenta de paciente no puede pertenecer a organization_members.';
    end if;
  elsif tg_table_name = 'organization_members' then
    if exists (
      select 1
      from public.patient_accounts account
      where account.user_id = new.user_id
        and account.status in ('active', 'suspended')
    ) then
      raise exception using
        errcode = '23514',
        message = 'Un usuario con cuenta de paciente activa no puede ser miembro clínico.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_patient_clinical_membership() from public, anon, authenticated;

drop trigger if exists patient_accounts_prevent_clinical_membership on public.patient_accounts;
create trigger patient_accounts_prevent_clinical_membership
before insert or update of user_id, status on public.patient_accounts
for each row execute function public.prevent_patient_clinical_membership();

drop trigger if exists organization_members_prevent_patient_membership on public.organization_members;
create trigger organization_members_prevent_patient_membership
before insert or update of organization_id, user_id, role, status on public.organization_members
for each row execute function public.prevent_patient_clinical_membership();

create or replace function public.prevent_non_coordinator_admin_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coordinator_id uuid;
begin
  if new.role = 'clinic_admin' then
    select organization.created_by
      into coordinator_id
    from public.organizations organization
    where organization.id = new.organization_id;

    if coordinator_id is null or new.user_id <> coordinator_id then
      raise exception using
        errcode = '42501',
        message = 'Solo el coordinador de la clínica puede tener clinic_admin.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_non_coordinator_admin_membership() from public, anon, authenticated;

drop trigger if exists organization_members_enforce_coordinator_admin on public.organization_members;
create trigger organization_members_enforce_coordinator_admin
before insert or update of organization_id, user_id, role, status on public.organization_members
for each row execute function public.prevent_non_coordinator_admin_membership();

drop policy if exists "clinic admins can update their organizations" on public.organizations;
create policy "organization coordinators can update their organizations"
on public.organizations
for update
to authenticated
using (public.is_org_coordinator(id))
with check (public.is_org_coordinator(id));

drop policy if exists "clinic admins can create memberships" on public.organization_members;
create policy "organization coordinators can create staff memberships"
on public.organization_members
for insert
to authenticated
with check (
  public.is_org_coordinator(organization_id)
  and role <> 'clinic_admin'
);

drop policy if exists "clinic admins can update memberships" on public.organization_members;
create policy "organization coordinators can update staff memberships"
on public.organization_members
for update
to authenticated
using (public.is_org_coordinator(organization_id))
with check (
  public.is_org_coordinator(organization_id)
  and role <> 'clinic_admin'
);

drop policy if exists "clinic admins can read patient portal accounts" on public.patient_accounts;
create policy "organization coordinators can read patient portal accounts"
on public.patient_accounts
for select
to authenticated
using (public.is_org_coordinator(organization_id));

drop policy if exists "clinic admins can create patient portal accounts" on public.patient_accounts;
create policy "organization coordinators can create patient portal accounts"
on public.patient_accounts
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'active'
  and public.is_org_coordinator(organization_id)
  and exists (
    select 1
    from public.patients patient
    where patient.id = patient_accounts.patient_id
      and patient.organization_id = patient_accounts.organization_id
      and patient.deleted_at is null
  )
);

drop policy if exists "clinic admins can update patient portal accounts" on public.patient_accounts;
create policy "organization coordinators can update patient portal accounts"
on public.patient_accounts
for update
to authenticated
using (public.is_org_coordinator(organization_id))
with check (
  public.is_org_coordinator(organization_id)
  and (
    status <> 'active' or (
      status = 'active'
      and revoked_at is null
      and revoked_by is null
    )
  )
);

create or replace function public.register_clinic(clinic_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := (select auth.uid());
  new_organization_id uuid;
  normalized_name text := btrim(clinic_name);
begin
  if actor_id is null or not exists (
    select 1
    from public.organizations organization
    join public.organization_members member
      on member.organization_id = organization.id
     and member.user_id = actor_id
     and member.role = 'clinic_admin'
     and member.status = 'active'
    where organization.created_by = actor_id
  ) then
    raise exception using errcode = '42501', message = 'Solo el coordinador activo puede registrar clínicas.';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'El nombre de la clínica debe tener entre 2 y 160 caracteres.';
  end if;

  if exists (
    select 1
    from public.organizations organization
    where organization.created_by = actor_id
      and lower(organization.name) = lower(normalized_name)
  ) then
    raise exception using errcode = '23505', message = 'Ya coordinas una clínica con ese nombre.';
  end if;

  insert into public.organizations (name, created_by)
  values (normalized_name, actor_id)
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (new_organization_id, actor_id, 'clinic_admin', 'active');

  return new_organization_id;
end;
$$;

revoke execute on function public.register_clinic(text) from public, anon, authenticated;
grant execute on function public.register_clinic(text) to authenticated;

-- Defense in depth: even if a privileged data repair ever bypasses the
-- identity-separation triggers, a patient account must not read staff Storage.
drop policy if exists "members can read private retinal images" on storage.objects;
create policy "members can read private retinal images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'retinal-images-private'
  and public.is_org_member(public.try_parse_uuid((storage.foldername(name))[1]))
  and not exists (
    select 1
    from public.patient_accounts account
    where account.user_id = (select auth.uid())
      and account.status in ('active', 'suspended')
  )
);

-- Publishing is an explicit clinical action. A legacy/non-owner clinic_admin
-- must not retain publication authority after coordinator-only provisioning is
-- enabled; authorized professionals remain allowed to publish.
create or replace function public.publish_screening_to_patient(target_screening_id uuid)
returns public.screenings
language plpgsql
volatile
security invoker
set search_path = public, auth
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
    or not (
      public.is_org_coordinator(current_screening.organization_id)
      or public.has_org_role(
        current_screening.organization_id,
        array['authorized_professional']::public.organization_role[]
      )
    ) then
    raise exception using
      errcode = '42501',
      message = 'Solo el coordinador o un profesional autorizado puede publicar un reporte.';
  end if;

  if current_screening.status not in ('REVISADO', 'SEGUIMIENTO_REQUERIDO') then
    raise exception using
      errcode = 'check_violation',
      message = 'El screening debe estar aprobado antes de publicarse al paciente.';
  end if;

  if not exists (
    select 1 from public.professional_reviews review
    where review.screening_id = current_screening.id
      and review.organization_id = current_screening.organization_id
      and review.patient_id = current_screening.patient_id
      and review.deleted_at is null
      and review.review_status in ('REVISION_COMPLETADA', 'SEGUIMIENTO_REQUERIDO')
      and review.reviewed_at is not null
  ) then
    raise exception using
      errcode = 'check_violation',
      message = 'Debe existir una revisión profesional aprobada antes de publicar.';
  end if;

  if current_screening.patient_published_at is not null then
    return current_screening;
  end if;

  perform pg_catalog.set_config('retinacare.patient_portal_publish', 'true', true);

  update public.screenings
  set patient_published_at = pg_catalog.now(),
      patient_published_by = actor_id,
      patient_report_summary = coalesce(
        nullif(pg_catalog.btrim(current_screening.general_observations), ''),
        'Tu clínica compartió este informe. Consulta al profesional para conocer sus conclusiones.'
      ),
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
