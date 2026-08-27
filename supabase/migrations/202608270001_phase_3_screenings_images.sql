alter type public.audit_action add value if not exists 'screening.created';
alter type public.audit_action add value if not exists 'screening.updated';
alter type public.audit_action add value if not exists 'screening.closed';
alter type public.audit_action add value if not exists 'screening.deleted';
alter type public.audit_action add value if not exists 'retinal_image.uploaded';
alter type public.audit_action add value if not exists 'retinal_image.replaced';
alter type public.audit_action add value if not exists 'retinal_image.deleted';
alter type public.audit_action add value if not exists 'image_quality_review.recorded';

alter type public.patient_timeline_event_type add value if not exists 'screening.created';
alter type public.patient_timeline_event_type add value if not exists 'screening.updated';
alter type public.patient_timeline_event_type add value if not exists 'screening.closed';
alter type public.patient_timeline_event_type add value if not exists 'screening.deleted';
alter type public.patient_timeline_event_type add value if not exists 'retinal_image.uploaded';
alter type public.patient_timeline_event_type add value if not exists 'retinal_image.replaced';
alter type public.patient_timeline_event_type add value if not exists 'retinal_image.deleted';
alter type public.patient_timeline_event_type add value if not exists 'image_quality_review.recorded';

create type public.screening_status as enum (
  'BORRADOR',
  'CAPTURA_PENDIENTE',
  'IMAGENES_COMPLETAS',
  'PENDIENTE_REVISION',
  'REVISADO',
  'SEGUIMIENTO_REQUERIDO',
  'CERRADO'
);

create type public.retinal_image_laterality as enum (
  'OD',
  'OI'
);

create type public.retinal_image_status as enum (
  'ACTIVA',
  'REEMPLAZADA',
  'ELIMINADA'
);

create type public.image_quality_status as enum (
  'PENDIENTE',
  'ADECUADA',
  'INADECUADA'
);

create type public.image_quality_reason as enum (
  'DESENFOQUE',
  'REFLEJO',
  'MALA_ILUMINACION',
  'CAMPO_INCOMPLETO',
  'MOVIMIENTO',
  'OTRO'
);

create table public.screenings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  status public.screening_status not null default 'BORRADOR',
  general_observations text,
  assigned_reviewer_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint screenings_general_observations_length check (
    general_observations is null or char_length(general_observations) <= 1200
  ),
  constraint screenings_closed_state_consistency check (
    (status = 'CERRADO' and closed_at is not null) or (status <> 'CERRADO')
  )
);

create table public.retinal_images (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  screening_id uuid not null references public.screenings(id) on delete cascade,
  laterality public.retinal_image_laterality not null,
  captured_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null,
  original_file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  hash_sha256 text,
  status public.retinal_image_status not null default 'ACTIVA',
  replaced_by_image_id uuid references public.retinal_images(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retinal_images_original_file_name_length check (char_length(trim(original_file_name)) between 1 and 240),
  constraint retinal_images_storage_path_length check (char_length(trim(storage_path)) between 8 and 900),
  constraint retinal_images_private_path check (storage_path like organization_id::text || '/%'),
  constraint retinal_images_mime_type_allowed check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint retinal_images_size_positive check (size_bytes > 0),
  constraint retinal_images_hash_sha256_format check (hash_sha256 is null or hash_sha256 ~ '^[a-f0-9]{64}$')
);

create table public.image_quality_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  screening_id uuid not null references public.screenings(id) on delete cascade,
  retinal_image_id uuid not null references public.retinal_images(id) on delete cascade,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  quality_status public.image_quality_status not null default 'PENDIENTE',
  reasons public.image_quality_reason[] not null default '{}',
  other_reason text,
  suggestion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint image_quality_reviews_one_per_image unique (retinal_image_id),
  constraint image_quality_reviews_reasons_only_when_inadequate check (
    (quality_status = 'INADECUADA' and cardinality(reasons) > 0)
    or (quality_status <> 'INADECUADA' and cardinality(reasons) = 0)
  ),
  constraint image_quality_reviews_suggestion_beta check (
    suggestion is null or suggestion = 'Repetir captura'
  ),
  constraint image_quality_reviews_other_reason_length check (other_reason is null or char_length(other_reason) <= 240)
);

create index screenings_organization_patient_idx on public.screenings(organization_id, patient_id, created_at desc);
create index screenings_status_idx on public.screenings(organization_id, status) where deleted_at is null;
create index screenings_reviewer_idx on public.screenings(assigned_reviewer_id) where assigned_reviewer_id is not null;
create index retinal_images_screening_idx on public.retinal_images(screening_id, laterality);
create index retinal_images_patient_idx on public.retinal_images(organization_id, patient_id, captured_at desc);
create unique index retinal_images_one_active_per_laterality_idx
  on public.retinal_images(screening_id, laterality)
  where status = 'ACTIVA' and deleted_at is null;
create index image_quality_reviews_screening_idx on public.image_quality_reviews(screening_id, quality_status);

create trigger screenings_set_updated_at
before update on public.screenings
for each row execute function public.set_updated_at();

create trigger retinal_images_set_updated_at
before update on public.retinal_images
for each row execute function public.set_updated_at();

create trigger image_quality_reviews_set_updated_at
before update on public.image_quality_reviews
for each row execute function public.set_updated_at();

alter table public.screenings enable row level security;
alter table public.retinal_images enable row level security;
alter table public.image_quality_reviews enable row level security;

create policy "members can read screenings in their organization"
on public.screenings
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "authorized staff can create screenings"
on public.screenings
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  )
);

create policy "authorized users can update screenings"
on public.screenings
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff', 'authorized_professional']::public.organization_role[]
  )
)
with check (
  updated_by = auth.uid()
  and public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff', 'authorized_professional']::public.organization_role[]
  )
);

create policy "members can read retinal images in their organization"
on public.retinal_images
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "authorized staff can insert retinal images"
on public.retinal_images
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  )
);

create policy "authorized staff can update retinal images"
on public.retinal_images
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  )
);

create policy "members can read image quality reviews in their organization"
on public.image_quality_reviews
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "authorized users can insert image quality reviews"
on public.image_quality_reviews
for insert
to authenticated
with check (
  reviewer_user_id = auth.uid()
  and public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff', 'authorized_professional']::public.organization_role[]
  )
);

create policy "authorized users can update image quality reviews"
on public.image_quality_reviews
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff', 'authorized_professional']::public.organization_role[]
  )
)
with check (
  reviewer_user_id = auth.uid()
  and public.has_org_role(
    organization_id,
    array['clinic_admin', 'technical_staff', 'authorized_professional']::public.organization_role[]
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'retinal-images-private',
  'retinal-images-private',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'members can read private retinal images'
  ) then
    create policy "members can read private retinal images"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'retinal-images-private'
      and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
      and public.is_org_member(split_part(name, '/', 1)::uuid)
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'authorized staff can upload private retinal images'
  ) then
    create policy "authorized staff can upload private retinal images"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'retinal-images-private'
      and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
      and public.has_org_role(
        split_part(name, '/', 1)::uuid,
        array['clinic_admin', 'technical_staff']::public.organization_role[]
      )
    );
  end if;
end $$;
