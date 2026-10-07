-- Endurece la subida de imágenes y permite limpiar objetos huérfanos dentro del tenant.

drop policy if exists "authorized staff can delete private retinal images" on storage.objects;
create policy "authorized staff can delete private retinal images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'retinal-images-private'
  and public.has_org_role(
    public.try_parse_uuid((storage.foldername(name))[1]),
    array['clinic_admin', 'technical_staff']::public.organization_role[]
  )
);

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

  if not public.has_org_role(target_organization_id, array['clinic_admin', 'technical_staff']::public.organization_role[]) then
    raise exception 'ROLE_CANNOT_UPLOAD_IMAGE' using errcode = '42501';
  end if;

  if target_original_file_name is null or char_length(trim(target_original_file_name)) not between 1 and 240 then
    raise exception 'INVALID_FILE_NAME' using errcode = '22023';
  end if;

  if target_mime_type not in ('image/jpeg', 'image/png', 'image/webp') or target_size_bytes <= 0 or target_size_bytes > 15728640 then
    raise exception 'INVALID_IMAGE_FILE' using errcode = '22023';
  end if;

  if target_storage_path not like target_organization_id::text || '/' || target_patient_id::text || '/' || target_screening_id::text || '/' || target_laterality::text || '/%' then
    raise exception 'INVALID_STORAGE_PATH' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.screenings
    where id = target_screening_id and organization_id = target_organization_id
      and patient_id = target_patient_id and status <> 'CERRADO' and deleted_at is null
  ) then
    raise exception 'OPEN_SCREENING_NOT_FOUND' using errcode = 'P0002';
  end if;

  select id into previous_image_id
  from public.retinal_images
  where screening_id = target_screening_id and organization_id = target_organization_id
    and patient_id = target_patient_id and laterality = target_laterality
    and status = 'ACTIVA' and deleted_at is null
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
    trim(target_original_file_name), target_storage_path, target_mime_type, target_size_bytes, target_hash_sha256, 'ACTIVA'
  ) returning id into created_image_id;

  if previous_image_id is not null then
    update public.retinal_images set replaced_by_image_id = created_image_id where id = previous_image_id;
  end if;

  return created_image_id;
end;
$$;

revoke all on function public.register_retinal_image(uuid, uuid, uuid, public.retinal_image_laterality, text, text, text, bigint, text) from public;
grant execute on function public.register_retinal_image(uuid, uuid, uuid, public.retinal_image_laterality, text, text, text, bigint, text) to authenticated;
