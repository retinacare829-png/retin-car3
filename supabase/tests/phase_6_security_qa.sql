-- QA transaccional Fase 6: Seguridad, Auth, RLS, Storage y límites beta.
-- Ejecutar después de `supabase db reset`; todos los cambios se revierten.
\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'QA_ASSERTION_FAILED: %', message;
  end if;
end;
$$;

-- Invariantes de configuración que no deben depender de la interfaz.
select pg_temp.assert_true(
  exists (
    select 1 from storage.buckets
    where id = 'retinal-images-private'
      and public = false
      and file_size_limit = 15728640
      and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  'el bucket retinal-images-private debe ser privado y limitarse a 15 MiB'
);

select pg_temp.assert_true(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'organizations')
  and (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'patients')
  and (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'screenings')
  and (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'retinal_images')
  and (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'audit_logs'),
  'las tablas de identidad, datos clínicos, imágenes y auditoría deben tener RLS'
);

select pg_temp.assert_true(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname in (
      'members can read private retinal images',
      'authorized staff can upload private retinal images',
      'authorized staff can delete private retinal images'
    )) = 3,
  'Storage debe tener lectura, subida y eliminación con políticas explícitas'
);

select pg_temp.assert_true(
  exists (select 1 from pg_trigger where tgname = 'on_auth_user_created'),
  'Auth debe crear el perfil asociado mediante el trigger de alta'
);

select pg_temp.assert_true(
  not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typnamespace = 'public'::regnamespace
      and e.enumlabel ilike '%diagnost%'
  ),
  'los estados persistidos no deben introducir estados diagnósticos'
);

-- Las aserciones siguientes se ejecutan con el rol de la API para que RLS sea real.
set local role authenticated;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(auth.uid() = '90000000-0000-4000-8000-000000000002'::uuid, 'Auth debe resolver request.jwt.claim.sub');
select pg_temp.assert_true(public.is_org_member('10000000-0000-4000-8000-000000000001'::uuid), 'admin activo debe ser miembro de Clínica A');
select pg_temp.assert_true(public.has_org_role('10000000-0000-4000-8000-000000000001'::uuid, array['clinic_admin']::public.organization_role[]), 'admin debe conservar su rol');
select pg_temp.assert_true((select count(*) from public.organizations) = 1, 'admin A debe ver una sola organización');
select pg_temp.assert_true((select count(*) from public.patients where organization_id = '10000000-0000-4000-8000-000000000001') = 2, 'admin A debe ver sus pacientes');
select pg_temp.assert_true((select count(*) from public.patients where organization_id = '10000000-0000-4000-8000-000000000002') = 0, 'admin A no debe ver pacientes de Clínica B');

-- La relación compuesta evita persistir un screening con paciente de otro tenant.
do $$
begin
  begin
    insert into public.screenings (organization_id, patient_id, status, created_by)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000003',
      'CAPTURA_PENDIENTE',
      '90000000-0000-4000-8000-000000000002'
    );
    raise exception 'QA_ASSERTION_FAILED: se aceptó relación cruzada de tenant';
  exception when foreign_key_violation then null;
  end;
end;
$$;

-- Solo un administrador puede leer auditoría; el registro temporal se revierte.
insert into public.audit_logs (
  organization_id, actor_user_id, action, entity_type, entity_id, changed_fields, metadata
) values (
  '10000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000002',
  'patient.updated',
  'qa_security',
  '20000000-0000-4000-8000-000000000001',
  array['qa'],
  jsonb_build_object('status', 'verified')
);
select pg_temp.assert_true(
  exists (select 1 from public.audit_logs where entity_type = 'qa_security'),
  'admin activo debe poder registrar y leer auditoría de su tenant'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true((select count(*) from public.organizations) = 1, 'admin B debe ver únicamente su organización');
select pg_temp.assert_true((select count(*) from public.patients where organization_id = '10000000-0000-4000-8000-000000000001') = 0, 'admin B no debe ver pacientes de Clínica A');
select pg_temp.assert_true((select count(*) from public.audit_logs where entity_type = 'qa_security') = 0, 'admin B no debe leer auditoría de Clínica A');

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true((select count(*) from public.patients where organization_id = '10000000-0000-4000-8000-000000000001') = 2, 'profesional debe leer datos de su tenant');
select pg_temp.assert_true((select count(*) from public.audit_logs where entity_type = 'qa_security') = 0, 'profesional no debe leer auditoría administrativa');

do $$
begin
  begin
    insert into public.patients (
      organization_id, internal_identifier, medical_record_code, first_names, last_names,
      date_of_birth, created_by
    ) values (
      '10000000-0000-4000-8000-000000000001', 'QA-PRO-001', 'QA-PRO-001', 'QA', 'Profesional',
      '1980-01-01', '90000000-0000-4000-8000-000000000001'
    );
    raise exception 'QA_ASSERTION_FAILED: profesional creó paciente';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Personal técnico puede operar captura, pero no decisiones profesionales ni cierre.
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(public.has_org_role('10000000-0000-4000-8000-000000000001', array['technical_staff']::public.organization_role[]), 'técnico debe conservar su rol');

do $$
begin
  begin
    insert into public.professional_reviews (
      organization_id, patient_id, screening_id, reviewer_user_id, review_status
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003',
      '90000000-0000-4000-8000-000000000003',
      'EN_REVISION'
    );
    raise exception 'QA_ASSERTION_FAILED: técnico creó revisión profesional';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
begin
  begin
    perform public.close_screening_workflow(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003'
    );
    raise exception 'QA_ASSERTION_FAILED: técnico cerró screening';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- El tamaño máximo debe defenderse también en el RPC, no solo en la interfaz.
do $$
begin
  begin
    perform public.register_retinal_image(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003',
      'OD',
      'qa-too-large.png',
      '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/30000000-0000-4000-8000-000000000003/OD/qa-too-large.png',
      'image/png',
      15728641,
      null
    );
    raise exception 'QA_ASSERTION_FAILED: RPC aceptó imagen mayor de 15 MiB';
  exception when sqlstate '22023' then null;
  end;
end;
$$;

-- Una membresía suspendida o una cuenta sin organización no obtiene filas por RLS.
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true(not public.is_org_member('10000000-0000-4000-8000-000000000001'), 'membresía suspendida no debe ser miembro activo');
select pg_temp.assert_true((select count(*) from public.organizations) = 0, 'usuario suspendido no debe ver organizaciones');
select pg_temp.assert_true((select count(*) from public.patients) = 0, 'usuario suspendido no debe ver pacientes');
select pg_temp.assert_true((select count(*) from public.retinal_images) = 0, 'usuario suspendido no debe ver imágenes');

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000006', true);
select pg_temp.assert_true((select count(*) from public.organizations) = 0, 'usuario sin organización no debe ver organizaciones');
select pg_temp.assert_true((select count(*) from public.patients) = 0, 'usuario sin organización no debe ver pacientes');

rollback;

\echo 'QA Supabase Fase 6 Seguridad: OK'
