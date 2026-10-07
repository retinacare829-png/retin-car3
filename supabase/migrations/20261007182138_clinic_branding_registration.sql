-- Identidad visual por clínica. El logo es privado y solo los miembros activos
-- pueden leerlo; únicamente un administrador puede reemplazarlo.
alter table public.organizations
  add column brand_theme text not null default 'retina'
    check (brand_theme in ('retina', 'ocean', 'violet', 'sunset')),
  add column logo_path text
    check (logo_path is null or logo_path = id::text || '/logo');

-- Evita filas huérfanas creadas con INSERT directo: el alta pública pasa por
-- register_clinic, que asigna el administrador en la misma transacción.
drop policy if exists "authenticated users can create organizations" on public.organizations;
alter function public.set_updated_at() set search_path = pg_catalog;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinic-branding-private', 'clinic-branding-private', false, 1048576,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members can read clinic branding"
on storage.objects for select to authenticated
using (
  bucket_id = 'clinic-branding-private'
  and name = public.try_parse_uuid((storage.foldername(name))[1])::text || '/logo'
  and public.is_org_member(public.try_parse_uuid((storage.foldername(name))[1]))
);

create policy "admins can upload clinic branding"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'clinic-branding-private'
  and name = public.try_parse_uuid((storage.foldername(name))[1])::text || '/logo'
  and public.has_org_role(
    public.try_parse_uuid((storage.foldername(name))[1]),
    array['clinic_admin']::public.organization_role[]
  )
);

create policy "admins can replace clinic branding"
on storage.objects for update to authenticated
using (
  bucket_id = 'clinic-branding-private'
  and name = public.try_parse_uuid((storage.foldername(name))[1])::text || '/logo'
  and public.has_org_role(
    public.try_parse_uuid((storage.foldername(name))[1]),
    array['clinic_admin']::public.organization_role[]
  )
)
with check (
  bucket_id = 'clinic-branding-private'
  and name = public.try_parse_uuid((storage.foldername(name))[1])::text || '/logo'
  and public.has_org_role(
    public.try_parse_uuid((storage.foldername(name))[1]),
    array['clinic_admin']::public.organization_role[]
  )
);

-- Alta atómica: la clínica recién creada y su primer administrador aparecen
-- juntos o no aparecen. Solo un administrador activo puede registrar otra.
create or replace function public.register_clinic(clinic_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  new_organization_id uuid;
  normalized_name text := btrim(clinic_name);
begin
  if actor_id is null or not exists (
    select 1 from public.organization_members member
    where member.user_id = actor_id
      and member.status = 'active'
      and member.role = 'clinic_admin'
  ) then
    raise exception using errcode = '42501', message = 'Solo un administrador activo puede registrar clínicas.';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'El nombre de la clínica debe tener entre 2 y 160 caracteres.';
  end if;

  if exists (
    select 1 from public.organizations organization
    join public.organization_members member on member.organization_id = organization.id
    where member.user_id = actor_id
      and member.status = 'active'
      and lower(organization.name) = lower(normalized_name)
  ) then
    raise exception using errcode = '23505', message = 'Ya administras una clínica con ese nombre.';
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
