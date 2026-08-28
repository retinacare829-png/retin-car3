alter type public.audit_action add value if not exists 'professional_review.created';
alter type public.audit_action add value if not exists 'professional_review.updated';
alter type public.audit_action add value if not exists 'follow_up.created';
alter type public.audit_action add value if not exists 'follow_up.updated';
alter type public.audit_action add value if not exists 'referral.created';
alter type public.audit_action add value if not exists 'referral.updated';

alter type public.patient_timeline_event_type add value if not exists 'professional_review.created';
alter type public.patient_timeline_event_type add value if not exists 'professional_review.updated';
alter type public.patient_timeline_event_type add value if not exists 'follow_up.created';
alter type public.patient_timeline_event_type add value if not exists 'follow_up.updated';
alter type public.patient_timeline_event_type add value if not exists 'referral.created';
alter type public.patient_timeline_event_type add value if not exists 'referral.updated';

create type public.professional_review_status as enum (
  'PENDIENTE_REVISION', 'EN_REVISION', 'REVISION_COMPLETADA',
  'REQUIERE_RECAPTURA', 'SEGUIMIENTO_REQUERIDO', 'CERRADO'
);

create type public.follow_up_type as enum (
  'CONTROL_PROGRAMADO', 'REPETIR_ESTUDIO', 'REFERIR_OFTALMOLOGIA'
);

create type public.follow_up_status as enum (
  'SIN_SEGUIMIENTO', 'CONTROL_PROGRAMADO', 'REPETIR_ESTUDIO',
  'REFERIR_OFTALMOLOGIA', 'SEGUIMIENTO_COMPLETADO', 'CANCELADO'
);

create type public.referral_status as enum (
  'BORRADOR', 'SOLICITADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'
);

alter table public.screenings
  add constraint screenings_tenant_patient_key unique (id, organization_id, patient_id);

create table public.professional_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  screening_id uuid not null,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  review_status public.professional_review_status not null default 'PENDIENTE_REVISION',
  reviewed_at timestamptz,
  structured_observations jsonb not null default '{"insufficientQuality":false,"repeatedImageRecommended":false,"newCaptureRequired":false,"reviewCompleted":false,"followUpRecommended":false,"referralRecommended":false}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint professional_reviews_screening_tenant_fk
    foreign key (screening_id, organization_id, patient_id)
    references public.screenings(id, organization_id, patient_id) on delete restrict,
  constraint professional_reviews_observations_object check (jsonb_typeof(structured_observations) = 'object'),
  constraint professional_reviews_notes_length check (notes is null or char_length(notes) <= 1600),
  constraint professional_reviews_reviewed_at_consistency check (
    (review_status in ('REVISION_COMPLETADA', 'SEGUIMIENTO_REQUERIDO', 'CERRADO') and reviewed_at is not null)
    or review_status not in ('REVISION_COMPLETADA', 'SEGUIMIENTO_REQUERIDO', 'CERRADO')
  )
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  screening_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  follow_up_type public.follow_up_type not null,
  follow_up_status public.follow_up_status not null default 'SIN_SEGUIMIENTO',
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint follow_ups_screening_tenant_fk
    foreign key (screening_id, organization_id, patient_id)
    references public.screenings(id, organization_id, patient_id) on delete restrict,
  constraint follow_ups_notes_length check (notes is null or char_length(notes) <= 1200),
  constraint follow_ups_completed_at_consistency check (
    follow_up_status <> 'SEGUIMIENTO_COMPLETADO' or completed_at is not null
  )
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  screening_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  referral_reason text not null,
  referral_destination text not null,
  referral_status public.referral_status not null default 'BORRADOR',
  requested_date date not null default current_date,
  completed_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint referrals_screening_tenant_fk
    foreign key (screening_id, organization_id, patient_id)
    references public.screenings(id, organization_id, patient_id) on delete restrict,
  constraint referrals_reason_length check (char_length(trim(referral_reason)) between 2 and 500),
  constraint referrals_destination_length check (char_length(trim(referral_destination)) between 2 and 300),
  constraint referrals_notes_length check (notes is null or char_length(notes) <= 1200),
  constraint referrals_completed_date_consistency check (
    referral_status <> 'COMPLETADA' or completed_date is not null
  )
);

create unique index professional_reviews_one_active_per_screening_idx
  on public.professional_reviews(screening_id) where deleted_at is null;
create index professional_reviews_tenant_status_idx on public.professional_reviews(organization_id, review_status) where deleted_at is null;
create index professional_reviews_patient_idx on public.professional_reviews(organization_id, patient_id, created_at desc);
create index follow_ups_screening_status_idx on public.follow_ups(screening_id, follow_up_status) where deleted_at is null;
create index follow_ups_assigned_due_idx on public.follow_ups(organization_id, assigned_to, due_date) where deleted_at is null;
create index referrals_screening_status_idx on public.referrals(screening_id, referral_status) where deleted_at is null;
create index referrals_patient_idx on public.referrals(organization_id, patient_id, requested_date desc) where deleted_at is null;

create trigger professional_reviews_set_updated_at before update on public.professional_reviews
for each row execute function public.set_updated_at();
create trigger follow_ups_set_updated_at before update on public.follow_ups
for each row execute function public.set_updated_at();
create trigger referrals_set_updated_at before update on public.referrals
for each row execute function public.set_updated_at();

alter table public.professional_reviews enable row level security;
alter table public.follow_ups enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "members can read audit logs in their organization" on public.audit_logs;
create policy "clinic admins can read audit logs"
on public.audit_logs for select to authenticated
using (public.has_org_role(organization_id, array['clinic_admin']::public.organization_role[]));

create policy "members can read professional reviews"
on public.professional_reviews for select to authenticated
using (public.is_org_member(organization_id));
create policy "professionals can create professional reviews"
on public.professional_reviews for insert to authenticated
with check (
  reviewer_user_id = auth.uid()
  and public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = professional_reviews.organization_id and status <> 'CERRADO')
);
create policy "professionals can update professional reviews"
on public.professional_reviews for update to authenticated
using (
  public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and (
    exists (select 1 from public.screenings where id = screening_id and organization_id = professional_reviews.organization_id and status <> 'CERRADO')
    or review_status <> 'CERRADO'
  )
)
with check (
  reviewer_user_id = auth.uid()
  and public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and (
    exists (select 1 from public.screenings where id = screening_id and organization_id = professional_reviews.organization_id and status <> 'CERRADO')
    or review_status = 'CERRADO'
  )
);

create policy "members can read follow ups"
on public.follow_ups for select to authenticated
using (public.is_org_member(organization_id));
create policy "professionals can create follow ups"
on public.follow_ups for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = follow_ups.organization_id and status <> 'CERRADO')
);
create policy "professionals can update follow ups"
on public.follow_ups for update to authenticated
using (
  public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = follow_ups.organization_id and status <> 'CERRADO')
)
with check (
  public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = follow_ups.organization_id and status <> 'CERRADO')
);

create policy "members can read referrals"
on public.referrals for select to authenticated
using (public.is_org_member(organization_id));
create policy "professionals can create referrals"
on public.referrals for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = referrals.organization_id and status <> 'CERRADO')
);
create policy "professionals can update referrals"
on public.referrals for update to authenticated
using (
  public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = referrals.organization_id and status <> 'CERRADO')
)
with check (
  public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = referrals.organization_id and status <> 'CERRADO')
);

create or replace function public.screening_closure_requirements_met(target_screening_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    exists (select 1 from public.retinal_images where screening_id = target_screening_id and laterality = 'OD' and status = 'ACTIVA' and deleted_at is null)
    and exists (select 1 from public.retinal_images where screening_id = target_screening_id and laterality = 'OI' and status = 'ACTIVA' and deleted_at is null)
    and exists (
      select 1 from public.retinal_images image
      join public.image_quality_reviews quality on quality.retinal_image_id = image.id
      where image.screening_id = target_screening_id and image.laterality = 'OD' and image.status = 'ACTIVA'
        and image.deleted_at is null and quality.quality_status <> 'PENDIENTE'
    )
    and exists (
      select 1 from public.retinal_images image
      join public.image_quality_reviews quality on quality.retinal_image_id = image.id
      where image.screening_id = target_screening_id and image.laterality = 'OI' and image.status = 'ACTIVA'
        and image.deleted_at is null and quality.quality_status <> 'PENDIENTE'
    )
    and exists (select 1 from public.professional_reviews where screening_id = target_screening_id and review_status in ('REVISION_COMPLETADA', 'SEGUIMIENTO_REQUERIDO') and deleted_at is null)
    and (
      exists (select 1 from public.follow_ups where screening_id = target_screening_id and deleted_at is null)
      or exists (select 1 from public.referrals where screening_id = target_screening_id and deleted_at is null)
    );
$$;

revoke all on function public.screening_closure_requirements_met(uuid) from public;
grant execute on function public.screening_closure_requirements_met(uuid) to authenticated;

drop policy if exists "authorized users can update screenings" on public.screenings;

create policy "professionals can update and close screenings"
on public.screenings for update to authenticated
using (
  status <> 'CERRADO'
  and public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
)
with check (
  updated_by = auth.uid()
  and public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and (status <> 'CERRADO' or public.screening_closure_requirements_met(id))
);

create policy "technical staff can update open screenings without closing"
on public.screenings for update to authenticated
using (
  status <> 'CERRADO'
  and public.has_org_role(organization_id, array['technical_staff']::public.organization_role[])
)
with check (
  status <> 'CERRADO'
  and updated_by = auth.uid()
  and public.has_org_role(organization_id, array['technical_staff']::public.organization_role[])
);

drop policy if exists "authorized staff can insert retinal images" on public.retinal_images;
drop policy if exists "authorized staff can update retinal images" on public.retinal_images;
drop policy if exists "authorized users can insert image quality reviews" on public.image_quality_reviews;
drop policy if exists "authorized users can update image quality reviews" on public.image_quality_reviews;

create policy "authorized staff can insert images into open screenings"
on public.retinal_images for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and public.has_org_role(organization_id, array['clinic_admin', 'technical_staff']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = retinal_images.organization_id and status <> 'CERRADO')
);

create policy "authorized staff can update images in open screenings"
on public.retinal_images for update to authenticated
using (
  public.has_org_role(organization_id, array['clinic_admin', 'technical_staff']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = retinal_images.organization_id and status <> 'CERRADO')
)
with check (
  public.has_org_role(organization_id, array['clinic_admin', 'technical_staff']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = retinal_images.organization_id and status <> 'CERRADO')
);

create policy "authorized users can insert quality into open screenings"
on public.image_quality_reviews for insert to authenticated
with check (
  reviewer_user_id = auth.uid()
  and public.has_org_role(organization_id, array['clinic_admin', 'technical_staff', 'authorized_professional']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = image_quality_reviews.organization_id and status <> 'CERRADO')
);

create policy "authorized users can update quality in open screenings"
on public.image_quality_reviews for update to authenticated
using (
  public.has_org_role(organization_id, array['clinic_admin', 'technical_staff', 'authorized_professional']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = image_quality_reviews.organization_id and status <> 'CERRADO')
)
with check (
  reviewer_user_id = auth.uid()
  and public.has_org_role(organization_id, array['clinic_admin', 'technical_staff', 'authorized_professional']::public.organization_role[])
  and exists (select 1 from public.screenings where id = screening_id and organization_id = image_quality_reviews.organization_id and status <> 'CERRADO')
);
