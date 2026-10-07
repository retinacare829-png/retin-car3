-- QA transaccional: no deja clínicas ni pacientes de prueba.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then raise exception 'QA_ASSERTION_FAILED: %', message; end if;
end;
$$;

select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.register_clinic(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.register_clinic(text)', 'EXECUTE'),
  'registro de clínica solo para sesiones autenticadas'
);

select pg_temp.assert_true(
  (select not public from storage.buckets where id = 'clinic-branding-private')
  and (select file_size_limit = 1048576 from storage.buckets where id = 'clinic-branding-private')
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations'
    and policyname = 'authenticated users can create organizations'),
  'logo privado y alta directa de clínica deshabilitada'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
select public.register_clinic('QA Clínica Temporal') as id \gset created_

select pg_temp.assert_true(
  (select count(*) = 1 from public.organizations where id = :'created_id' and brand_theme = 'retina')
  and (select count(*) = 1 from public.organization_members where organization_id = :'created_id'
    and user_id = '90000000-0000-4000-8000-000000000002' and role = 'clinic_admin'),
  'registro atómico crea clínica y administrador'
);

update public.organizations set brand_theme = 'violet' where id = :'created_id';
select pg_temp.assert_true(
  (select brand_theme = 'violet' from public.organizations where id = :'created_id'),
  'administrador puede cambiar paleta'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
do $$
begin
  begin
    perform public.register_clinic('QA No Autorizada');
    raise exception 'QA_ASSERTION_FAILED: técnico pudo registrar clínica';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select pg_temp.assert_true(
  not exists (select 1 from public.organizations where id = :'created_id'),
  'técnico no ve clínica de otro contexto'
);

set local role postgres;
select pg_temp.assert_true(
  (select count(*) = 1 from public.organizations where id = :'created_id'),
  'denegación al técnico no eliminó la clínica temporal'
);

rollback;
