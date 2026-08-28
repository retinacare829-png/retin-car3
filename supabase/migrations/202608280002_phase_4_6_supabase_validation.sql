-- Fase 4.6: consistencia multi-tenant, Storage privado y cierre atomico.
-- Esta migracion es aditiva; no modifica destructivamente migraciones previas.

alter table public.patients
  add constraint patients_tenant_key unique (id, organization_id);

alter table public.screenings
  add constraint screenings_patient_tenant_fk
  foreign key (patient_id, organization_id)
  references public.patients(id, organization_id) on delete restrict;

alter table public.retinal_images
  add constraint retinal_images_tenant_key unique (id, organization_id, patient_id, screening_id),
  add constraint retinal_images_patient_tenant_fk
    foreign key (patient_id, organization_id)
    references public.patients(id, organization_id) on delete restrict,
  add constraint retinal_images_screening_tenant_fk
    foreign key (screening_id, organization_id, patient_id)
    references public.screenings(id, organization_id, patient_id) on delete restrict,
  add constraint retinal_images_full_private_path check (
    storage_path like organization_id::text || '/' || patient_id::text || '/' || screening_id::text || '/' || laterality::text || '/%'
  );

alter table public.image_quality_reviews
  add constraint image_quality_reviews_patient_tenant_fk
    foreign key (patient_id, organization_id)
    references public.patients(id, organization_id) on delete restrict,
  add constraint image_quality_reviews_screening_tenant_fk
    foreign key (screening_id, organization_id, patient_id)
    references public.screenings(id, organization_id, patient_id) on delete restrict,
  add constraint image_quality_reviews_image_tenant_fk
    foreign key (retinal_image_id, organization_id, patient_id, screening_id)
    references public.retinal_images(id, organization_id, patient_id, screening_id) on delete restrict;

alter table public.patient_timeline_events
  add constraint patient_timeline_events_patient_tenant_fk
  foreign key (patient_id, organization_id)
  references public.patients(id, organization_id) on delete restrict;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;

create or replace function public.try_parse_uuid(candidate text)
returns uuid
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
begin
  return candidate::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke all on function public.try_parse_uuid(text) from public;
grant execute on function public.try_parse_uuid(text) to authenticated;

drop policy if exists "members can read private retinal images" on storage.objects;
drop policy if exists "authorized staff can upload private retinal images" on storage.objects;

create policy "members can read private retinal images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'retinal-images-private'
  and public.is_org_member(public.try_parse_uuid((storage.foldername(name))[1]))
);

create policy "authorized staff can upload private retinal images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'retinal-images-private'
  and public.has_org_role(
    public.try_parse_uuid((storage.foldername(name))[1]),
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  )
);

-- El objeto binario no se elimina fisicamente desde la beta. La eliminacion logica
-- se registra en public.retinal_images, preservando trazabilidad.

create or replace function public.register_retinal_image(
  target_organization_id uuid,
  target_patient_id uuid,
  target_screening_id uuid,
  target_laterality public.retinal_image_laterality,
  target_original_file_name text,
  target_storage_path text,
  target_mime_type text,
  target_size_bytes bigint,
  target_hash_sha256 text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
  previous_image_id uuid;
  created_image_id uuid;
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  ) then
    raise exception 'ROLE_CANNOT_UPLOAD_IMAGE' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.screenings
    where id = target_screening_id
      and organization_id = target_organization_id
      and patient_id = target_patient_id
      and status <> 'CERRADO'
      and deleted_at is null
  ) then
    raise exception 'OPEN_SCREENING_NOT_FOUND' using errcode = 'P0002';
  end if;

  select id into previous_image_id
  from public.retinal_images
  where screening_id = target_screening_id
    and organization_id = target_organization_id
    and patient_id = target_patient_id
    and laterality = target_laterality
    and status = 'ACTIVA'
    and deleted_at is null
  for update;

  if previous_image_id is not null then
    update public.retinal_images
    set status = 'REEMPLAZADA', deleted_at = now(), deleted_by = actor_id
    where id = previous_image_id;
  end if;

  insert into public.retinal_images (
    organization_id, patient_id, screening_id, laterality, uploaded_by,
    original_file_name, storage_path, mime_type, size_bytes, hash_sha256, status
  ) values (
    target_organization_id, target_patient_id, target_screening_id, target_laterality, actor_id,
    target_original_file_name, target_storage_path, target_mime_type, target_size_bytes, target_hash_sha256, 'ACTIVA'
  ) returning id into created_image_id;

  if previous_image_id is not null then
    update public.retinal_images
    set replaced_by_image_id = created_image_id
    where id = previous_image_id;
  end if;

  return created_image_id;
end;
$$;

revoke all on function public.register_retinal_image(uuid, uuid, uuid, public.retinal_image_laterality, text, text, text, bigint, text) from public;
grant execute on function public.register_retinal_image(uuid, uuid, uuid, public.retinal_image_laterality, text, text, text, bigint, text) to authenticated;

drop policy if exists "professionals can update professional reviews" on public.professional_reviews;
create policy "professionals can update reviews in open screenings"
on public.professional_reviews for update to authenticated
using (
  public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and exists (
    select 1 from public.screenings
    where id = screening_id
      and organization_id = professional_reviews.organization_id
      and status <> 'CERRADO'
  )
)
with check (
  reviewer_user_id = auth.uid()
  and public.has_org_role(organization_id, array['clinic_admin', 'authorized_professional']::public.organization_role[])
  and exists (
    select 1 from public.screenings
    where id = screening_id
      and organization_id = professional_reviews.organization_id
      and status <> 'CERRADO'
  )
);

create or replace function public.close_screening_workflow(
  target_organization_id uuid,
  target_patient_id uuid,
  target_screening_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
  closed_timestamp timestamptz := now();
  current_status public.screening_status;
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select status into current_status
  from public.screenings
  where id = target_screening_id
    and organization_id = target_organization_id
    and patient_id = target_patient_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'SCREENING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if current_status = 'CERRADO' then
    raise exception 'SCREENING_ALREADY_CLOSED' using errcode = 'P0001';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['clinic_admin', 'authorized_professional']::public.organization_role[]
  ) then
    raise exception 'ROLE_CANNOT_CLOSE_SCREENING' using errcode = '42501';
  end if;

  if not public.screening_closure_requirements_met(target_screening_id) then
    raise exception 'SCREENING_CLOSURE_REQUIREMENTS_NOT_MET' using errcode = '23514';
  end if;

  update public.screenings
  set status = 'CERRADO', closed_at = closed_timestamp, closed_by = actor_id, updated_by = actor_id
  where id = target_screening_id
    and organization_id = target_organization_id
    and patient_id = target_patient_id;

  update public.professional_reviews
  set review_status = 'CERRADO', reviewed_at = closed_timestamp, reviewer_user_id = actor_id
  where screening_id = target_screening_id
    and organization_id = target_organization_id
    and patient_id = target_patient_id
    and deleted_at is null;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, changed_fields, metadata
  ) values (
    target_organization_id, actor_id, 'screening.closed', 'screening', target_screening_id,
    array['status', 'closedAt', 'closedBy'], jsonb_build_object('status', 'CERRADO')
  );

  insert into public.patient_timeline_events (
    organization_id, patient_id, event_type, title, actor_user_id, metadata
  ) values (
    target_organization_id, target_patient_id, 'screening.closed', 'Screening cerrado', actor_id,
    jsonb_build_object('status', 'CERRADO')
  );
end;
$$;

revoke all on function public.close_screening_workflow(uuid, uuid, uuid) from public;
grant execute on function public.close_screening_workflow(uuid, uuid, uuid) to authenticated;
