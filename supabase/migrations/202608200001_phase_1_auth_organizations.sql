create extension if not exists pgcrypto;

create type public.organization_role as enum (
  'clinic_admin',
  'technical_staff',
  'authorized_professional'
);

create type public.organization_member_status as enum (
  'active',
  'invited',
  'suspended'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_identifier text,
  country_code char(2) not null default 'NI',
  timezone text not null default 'America/Managua',
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint organizations_name_length check (char_length(trim(name)) between 2 and 160),
  constraint organizations_country_code_format check (country_code ~ '^[A-Z]{2}$')
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  professional_license text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(trim(display_name)) between 2 and 160)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null,
  status public.organization_member_status not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organizations_created_by_idx on public.organizations(created_by);
create index organization_members_user_idx on public.organization_members(user_id);
create index organization_members_organization_idx on public.organization_members(organization_id);
create index organization_members_active_idx on public.organization_members(organization_id, user_id)
  where status = 'active';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.has_org_role(
  target_organization_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role = any(allowed_roles)
  );
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;

create policy "members can read their organizations"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy "authenticated users can create organizations"
on public.organizations
for insert
to authenticated
with check (created_by = auth.uid());

create policy "clinic admins can update their organizations"
on public.organizations
for update
to authenticated
using (public.has_org_role(id, array['clinic_admin']::public.organization_role[]))
with check (public.has_org_role(id, array['clinic_admin']::public.organization_role[]));

create policy "users can read their own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "users can create their own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "members can read memberships in their organizations"
on public.organization_members
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "clinic admins can create memberships"
on public.organization_members
for insert
to authenticated
with check (public.has_org_role(organization_id, array['clinic_admin']::public.organization_role[]));

create policy "clinic admins can update memberships"
on public.organization_members
for update
to authenticated
using (public.has_org_role(organization_id, array['clinic_admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['clinic_admin']::public.organization_role[]));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
