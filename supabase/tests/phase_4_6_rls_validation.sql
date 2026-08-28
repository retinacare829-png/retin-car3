-- QA transaccional Fase 4.6. Ejecutar despues de `supabase db reset`.
-- Requiere psql y revierte todos los cambios al finalizar.
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

select pg_temp.assert_true(
  exists(select 1 from storage.buckets where id = 'retinal-images-private' and public = false),
  'retinal-images-private debe existir y ser privado'
);

-- Fixture cruzado para demostrar aislamiento de screenings e imagenes.
insert into public.screenings (
  id, organization_id, patient_id, status, created_by
) values (
  '39000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  'CAPTURA_PENDIENTE',
  '90000000-0000-4000-8000-000000000004'
);

insert into public.retinal_images (
  id, organization_id, patient_id, screening_id, laterality, uploaded_by,
  original_file_name, storage_path, mime_type, size_bytes
) values (
  '49000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '39000000-0000-4000-8000-000000000001',
  'OD', '90000000-0000-4000-8000-000000000004', 'qa-clinic-b.png',
  '10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000003/39000000-0000-4000-8000-000000000001/OD/qa-clinic-b.png',
  'image/png', 68
);

-- Reabrir solo dentro de esta transaccion el fixture completo para probar el RPC.
update public.screenings
set status = 'REVISADO', closed_at = null, closed_by = null
where id = '30000000-0000-4000-8000-000000000002';
update public.professional_reviews
set review_status = 'REVISION_COMPLETADA'
where screening_id = '30000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);

select pg_temp.assert_true((select count(*) from public.patients where organization_id = '10000000-0000-4000-8000-000000000001') >= 2, 'technical_staff debe leer pacientes de Clinica A');
select pg_temp.assert_true((select count(*) from public.patients where organization_id = '10000000-0000-4000-8000-000000000002') = 0, 'technical_staff no debe leer pacientes de Clinica B');
select pg_temp.assert_true((select count(*) from public.screenings where organization_id = '10000000-0000-4000-8000-000000000002') = 0, 'technical_staff no debe leer screenings de Clinica B');
select pg_temp.assert_true((select count(*) from public.retinal_images where organization_id = '10000000-0000-4000-8000-000000000002') = 0, 'technical_staff no debe leer imagenes de Clinica B');

insert into public.patients (
  id, organization_id, internal_identifier, medical_record_code, first_names, last_names,
  date_of_birth, sex, diabetes_type, created_by
) values (
  '29000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'QA-TECH-001', 'QA-EXP-001', 'Paciente', 'QA', '1970-01-01', 'unknown', 'unknown',
  '90000000-0000-4000-8000-000000000003'
);
update public.patients
set last_names = 'QA Editado', updated_by = '90000000-0000-4000-8000-000000000003'
where id = '29000000-0000-4000-8000-000000000001';
update public.patients
set deleted_at = now(), deleted_by = '90000000-0000-4000-8000-000000000003', updated_by = '90000000-0000-4000-8000-000000000003'
where id = '29000000-0000-4000-8000-000000000001';
update public.patients
set deleted_at = null, deleted_by = null, updated_by = '90000000-0000-4000-8000-000000000003'
where id = '29000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  exists(select 1 from public.patients where internal_identifier = 'QA-TECH-001' and last_names = 'QA Editado' and deleted_at is null),
  'technical_staff debe crear, editar, archivar, restaurar y buscar paciente'
);

insert into public.screenings (
  id, organization_id, patient_id, status, created_by
) values (
  '39000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  '29000000-0000-4000-8000-000000000001',
  'CAPTURA_PENDIENTE',
  '90000000-0000-4000-8000-000000000003'
);

select public.register_retinal_image(
  '10000000-0000-4000-8000-000000000001', '29000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000002', 'OD', 'qa-od-1.png',
  '10000000-0000-4000-8000-000000000001/29000000-0000-4000-8000-000000000001/39000000-0000-4000-8000-000000000002/OD/qa-od-1.png',
  'image/png', 68, null
);
select public.register_retinal_image(
  '10000000-0000-4000-8000-000000000001', '29000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000002', 'OD', 'qa-od-2.png',
  '10000000-0000-4000-8000-000000000001/29000000-0000-4000-8000-000000000001/39000000-0000-4000-8000-000000000002/OD/qa-od-2.png',
  'image/png', 68, null
);
select public.register_retinal_image(
  '10000000-0000-4000-8000-000000000001', '29000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000002', 'OI', 'qa-oi.png',
  '10000000-0000-4000-8000-000000000001/29000000-0000-4000-8000-000000000001/39000000-0000-4000-8000-000000000002/OI/qa-oi.png',
  'image/png', 68, null
);

select pg_temp.assert_true(
  (select count(*) from public.retinal_images where screening_id = '39000000-0000-4000-8000-000000000002' and laterality = 'OD' and status = 'ACTIVA') = 1
  and (select count(*) from public.retinal_images where screening_id = '39000000-0000-4000-8000-000000000002' and laterality = 'OD' and status = 'REEMPLAZADA') = 1,
  'reemplazo OD debe conservar una sola imagen activa'
);

insert into public.image_quality_reviews (
  organization_id, patient_id, screening_id, retinal_image_id, reviewer_user_id, quality_status, reasons
)
select organization_id, patient_id, screening_id, id, '90000000-0000-4000-8000-000000000003', 'ADECUADA', '{}'
from public.retinal_images
where screening_id = '39000000-0000-4000-8000-000000000002' and status = 'ACTIVA';

do $$
begin
  begin
    perform public.close_screening_workflow(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002'
    );
    raise exception 'QA_ASSERTION_FAILED: technical_staff logro cerrar screening';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

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
    raise exception 'QA_ASSERTION_FAILED: technical_staff creo revision profesional';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);

insert into public.professional_reviews (
  organization_id, patient_id, screening_id, reviewer_user_id, review_status, reviewed_at,
  structured_observations
) values (
  '10000000-0000-4000-8000-000000000001', '29000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
  'REVISION_COMPLETADA', now(),
  '{"insufficientQuality":false,"repeatedImageRecommended":false,"newCaptureRequired":false,"reviewCompleted":true,"followUpRecommended":true,"referralRecommended":true}'::jsonb
);
insert into public.follow_ups (
  organization_id, patient_id, screening_id, created_by, follow_up_type, follow_up_status, due_date
) values (
  '10000000-0000-4000-8000-000000000001', '29000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
  'CONTROL_PROGRAMADO', 'CONTROL_PROGRAMADO', current_date + 30
);
insert into public.referrals (
  organization_id, patient_id, screening_id, created_by, referral_reason, referral_destination, referral_status
) values (
  '10000000-0000-4000-8000-000000000001', '29000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
  'QA de flujo', 'Centro ficticio', 'SOLICITADA'
);
select pg_temp.assert_true(
  public.screening_closure_requirements_met('39000000-0000-4000-8000-000000000002'),
  'checklist debe completarse con OD/OI, calidad, revision y decision'
);
select public.close_screening_workflow(
  '10000000-0000-4000-8000-000000000001',
  '29000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000002'
);
select pg_temp.assert_true(
  (select status = 'CERRADO' from public.screenings where id = '39000000-0000-4000-8000-000000000002'),
  'flujo QA completo debe cerrar mediante RPC'
);

select public.close_screening_workflow(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002'
);

select pg_temp.assert_true(
  (select status = 'CERRADO' and closed_by = '90000000-0000-4000-8000-000000000001' from public.screenings where id = '30000000-0000-4000-8000-000000000002'),
  'authorized_professional debe cerrar un screening completo'
);
select pg_temp.assert_true(
  exists(select 1 from public.audit_logs where entity_id = '30000000-0000-4000-8000-000000000002' and action = 'screening.closed'),
  'el cierre debe registrar auditoria'
);
select pg_temp.assert_true(
  exists(select 1 from public.patient_timeline_events where patient_id = '20000000-0000-4000-8000-000000000001' and event_type = 'screening.closed'),
  'el cierre debe registrar timeline'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true((select count(*) from public.patients where organization_id = '10000000-0000-4000-8000-000000000001') = 0, 'admin de Clinica B no debe leer pacientes de Clinica A');
select pg_temp.assert_true((select count(*) from public.screenings where organization_id = '10000000-0000-4000-8000-000000000002') = 1, 'admin de Clinica B debe leer su screening');
select pg_temp.assert_true((select count(*) from public.retinal_images where organization_id = '10000000-0000-4000-8000-000000000002') = 1, 'admin de Clinica B debe leer su imagen');

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true((select count(*) from public.organizations) = 0, 'membresia suspendida no debe conceder organizaciones');
select pg_temp.assert_true((select count(*) from public.patients) = 0, 'membresia suspendida no debe conceder pacientes');

reset role;

do $$
begin
  begin
    insert into public.screenings (
      organization_id, patient_id, status, created_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000003',
      'CAPTURA_PENDIENTE',
      '90000000-0000-4000-8000-000000000002'
    );
    raise exception 'QA_ASSERTION_FAILED: se acepto una relacion patient/organization cruzada';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

rollback;

\echo 'QA Supabase Fase 4.6: OK'
