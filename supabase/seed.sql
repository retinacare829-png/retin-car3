-- Cuentas exclusivamente locales/ficticias. Cambiar credenciales en cualquier entorno hospedado.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'profesional.demo@example.test', crypt('RetinaCare-Demo-2026!', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Profesional Demo"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin.demo@example.test', crypt('RetinaCare-Demo-2026!', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Administracion Demo"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'tecnico.demo@example.test', crypt('RetinaCare-Demo-2026!', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Tecnico Demo"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'admin.clinica-b@example.test', crypt('RetinaCare-Demo-2026!', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Administracion Clinica B"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'suspendido.demo@example.test', crypt('RetinaCare-Demo-2026!', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Usuario Suspendido Demo"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'sin.clinica.demo@example.test', crypt('RetinaCare-Demo-2026!', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Usuario Sin Clinica Demo"}'::jsonb, now(), now())
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
select
  ('91000000-0000-4000-8000-' || right(user_id::text, 12))::uuid,
  user_id,
  jsonb_build_object('sub', user_id::text, 'email', email),
  'email', user_id::text, now(), now(), now()
from (values
  ('90000000-0000-4000-8000-000000000001'::uuid, 'profesional.demo@example.test'),
  ('90000000-0000-4000-8000-000000000002'::uuid, 'admin.demo@example.test'),
  ('90000000-0000-4000-8000-000000000003'::uuid, 'tecnico.demo@example.test'),
  ('90000000-0000-4000-8000-000000000004'::uuid, 'admin.clinica-b@example.test'),
  ('90000000-0000-4000-8000-000000000005'::uuid, 'suspendido.demo@example.test'),
  ('90000000-0000-4000-8000-000000000006'::uuid, 'sin.clinica.demo@example.test')
) as demo_identities(user_id, email)
on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, display_name)
values
  ('90000000-0000-4000-8000-000000000001', 'Profesional Demo'),
  ('90000000-0000-4000-8000-000000000002', 'Administracion Demo'),
  ('90000000-0000-4000-8000-000000000003', 'Tecnico Demo'),
  ('90000000-0000-4000-8000-000000000004', 'Administracion Clinica B'),
  ('90000000-0000-4000-8000-000000000005', 'Usuario Suspendido Demo'),
  ('90000000-0000-4000-8000-000000000006', 'Usuario Sin Clinica Demo')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.organizations (id, name, legal_name, country_code, timezone, contact_email)
values
  ('10000000-0000-4000-8000-000000000001', 'Clinica Demo Oftalmologica', 'Clinica Demo Oftalmologica S.A.', 'NI', 'America/Managua', 'demo-oftalmologia@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'Centro Demo Diabetes', 'Centro Demo Diabetes S.A.', 'NI', 'America/Managua', 'demo-diabetes@example.test')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, status)
values
  ('10000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'authorized_professional', 'active'),
  ('10000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'clinic_admin', 'active'),
  ('10000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003', 'technical_staff', 'active'),
  ('10000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000004', 'clinic_admin', 'active'),
  ('10000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000005', 'technical_staff', 'suspended')
on conflict (organization_id, user_id) do update set
  role = excluded.role,
  status = excluded.status;

insert into public.patients (
  id,
  organization_id,
  internal_identifier,
  medical_record_code,
  first_names,
  last_names,
  date_of_birth,
  sex,
  phone,
  diabetes_diagnosis_date,
  diabetes_type,
  notes
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'DEMO-OFT-001',
    'EXP-DEMO-001',
    'Mariana Isabel',
    'Lopez Rivas',
    '1968-04-12',
    'female',
    '+505 8888 0101',
    '2014-08-01',
    'type_2',
    'Paciente ficticia para demostracion. No corresponde a una persona real.'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'DEMO-OFT-002',
    'EXP-DEMO-002',
    'Carlos Andres',
    'Mendoza Ruiz',
    '1959-11-03',
    'male',
    '+505 8888 0102',
    '2009-02-15',
    'type_2',
    'Paciente ficticio para validacion de flujo.'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    'DEMO-DIA-001',
    'EXP-DEMO-101',
    'Elena Sofia',
    'Castro Molina',
    '1975-07-26',
    'female',
    '+505 8888 0201',
    '2018-01-10',
    'type_2',
    'Registro ficticio de centro de diabetes.'
)
on conflict (id) do nothing;

insert into public.screenings (
  id,
  organization_id,
  patient_id,
  status,
  general_observations,
  created_at,
  updated_at,
  closed_at
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'PENDIENTE_REVISION',
    'Screening ficticio para demostracion beta.',
    '2026-08-18T14:00:00Z',
    '2026-08-18T14:20:00Z',
    null
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'CERRADO',
    'Screening ficticio cerrado sin conclusion diagnostica.',
    '2026-07-10T15:30:00Z',
    '2026-07-10T16:10:00Z',
    '2026-07-10T16:10:00Z'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'CAPTURA_PENDIENTE',
    null,
    '2026-08-20T09:15:00Z',
    '2026-08-20T09:15:00Z',
    null
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'REVISADO', 'Revision manual completada para demo.',
    '2026-08-21T10:00:00Z', '2026-08-21T11:00:00Z', null
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'SEGUIMIENTO_REQUERIDO', 'Seguimiento ficticio programado.',
    '2026-08-22T10:00:00Z', '2026-08-22T11:00:00Z', null
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'SEGUIMIENTO_REQUERIDO', 'Referencia ficticia creada.',
    '2026-08-23T10:00:00Z', '2026-08-23T11:00:00Z', null
  )
on conflict (id) do nothing;

insert into public.retinal_images (
  id,
  organization_id,
  patient_id,
  screening_id,
  laterality,
  captured_at,
  original_file_name,
  storage_path,
  mime_type,
  size_bytes,
  hash_sha256,
  status
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'OD',
    '2026-08-18T14:10:00Z',
    'demo-od-placeholder.jpg',
    '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/OD/demo-od-placeholder.jpg',
    'image/jpeg',
    204800,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'ACTIVA'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'OI',
    '2026-08-18T14:12:00Z',
    'demo-oi-placeholder.jpg',
    '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/OI/demo-oi-placeholder.jpg',
    'image/jpeg',
    198400,
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'ACTIVA'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    'OD',
    '2026-07-10T15:40:00Z',
    'demo-previo-od-placeholder.png',
    '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000002/OD/demo-previo-od-placeholder.png',
    'image/png',
    184320,
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    'ACTIVA'
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    'OI', '2026-07-10T15:42:00Z', 'demo-previo-oi-placeholder.png',
    '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000002/OI/demo-previo-oi-placeholder.png',
    'image/png', 181120,
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'ACTIVA'
  )
on conflict (id) do nothing;

insert into public.image_quality_reviews (
  id,
  organization_id,
  patient_id,
  screening_id,
  retinal_image_id,
  quality_status,
  reasons,
  suggestion
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'ADECUADA',
    '{}',
    null
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    'INADECUADA',
    array['DESENFOQUE', 'REFLEJO']::public.image_quality_reason[],
    'Repetir captura'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003',
    'ADECUADA', '{}', null
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004',
    'ADECUADA', '{}', null
  )
on conflict (id) do nothing;

insert into public.professional_reviews (
  id, organization_id, patient_id, screening_id, reviewer_user_id, review_status,
  reviewed_at, structured_observations, notes, created_at, updated_at
)
values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'REQUIERE_RECAPTURA', null, '{"insufficientQuality":true,"repeatedImageRecommended":true,"newCaptureRequired":true,"reviewCompleted":false,"followUpRecommended":false,"referralRecommended":false}', null, '2026-08-18T14:30:00Z', '2026-08-18T14:30:00Z'),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'CERRADO', '2026-07-10T16:10:00Z', '{"insufficientQuality":false,"repeatedImageRecommended":false,"newCaptureRequired":false,"reviewCompleted":true,"followUpRecommended":false,"referralRecommended":false}', null, '2026-07-10T16:00:00Z', '2026-07-10T16:10:00Z'),
  ('60000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001', 'REVISION_COMPLETADA', '2026-08-21T11:00:00Z', '{"insufficientQuality":false,"repeatedImageRecommended":false,"newCaptureRequired":false,"reviewCompleted":true,"followUpRecommended":false,"referralRecommended":false}', null, '2026-08-21T10:30:00Z', '2026-08-21T11:00:00Z'),
  ('60000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '90000000-0000-4000-8000-000000000001', 'SEGUIMIENTO_REQUERIDO', '2026-08-22T11:00:00Z', '{"insufficientQuality":false,"repeatedImageRecommended":false,"newCaptureRequired":false,"reviewCompleted":true,"followUpRecommended":true,"referralRecommended":false}', null, '2026-08-22T10:30:00Z', '2026-08-22T11:00:00Z'),
  ('60000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000006', '90000000-0000-4000-8000-000000000001', 'SEGUIMIENTO_REQUERIDO', '2026-08-23T11:00:00Z', '{"insufficientQuality":false,"repeatedImageRecommended":false,"newCaptureRequired":false,"reviewCompleted":true,"followUpRecommended":false,"referralRecommended":true}', null, '2026-08-23T10:30:00Z', '2026-08-23T11:00:00Z')
on conflict (id) do nothing;

insert into public.follow_ups (id, organization_id, patient_id, screening_id, created_by, follow_up_type, follow_up_status, due_date, notes)
values
  ('70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'CONTROL_PROGRAMADO', 'SIN_SEGUIMIENTO', null, null),
  ('70000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', '90000000-0000-4000-8000-000000000001', 'CONTROL_PROGRAMADO', 'CONTROL_PROGRAMADO', current_date, 'Seguimiento ficticio visible en la agenda del día de la demostración.')
on conflict (id) do update set
  due_date = excluded.due_date,
  notes = excluded.notes;

insert into public.referrals (id, organization_id, patient_id, screening_id, created_by, referral_reason, referral_destination, referral_status, requested_date, notes)
values ('80000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000006', '90000000-0000-4000-8000-000000000001', 'Evaluacion profesional presencial', 'Centro oftalmologico demo', 'SOLICITADA', '2026-08-23', null)
on conflict (id) do nothing;

insert into public.patient_timeline_events (
  organization_id,
  patient_id,
  event_type,
  title,
  metadata,
  created_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'screening.created',
    'Screening creado',
    '{"status": "PENDIENTE_REVISION"}'::jsonb,
    '2026-08-18T14:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'retinal_image.uploaded',
    'Imagen cargada',
    '{"laterality": "OD"}'::jsonb,
    '2026-08-18T14:10:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'image_quality_review.recorded',
    'Calidad registrada',
    '{"quality_status": "INADECUADA"}'::jsonb,
    '2026-08-18T14:20:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'screening.closed',
    'Screening cerrado',
    '{"status": "CERRADO"}'::jsonb,
    '2026-07-10T16:10:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
    'professional_review.updated', 'Recaptura solicitada', '{"review_status":"REQUIERE_RECAPTURA"}'::jsonb,
    '2026-08-18T14:30:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
    'professional_review.updated', 'Revision completada', '{"review_status":"REVISION_COMPLETADA"}'::jsonb,
    '2026-08-21T11:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
    'follow_up.created', 'Seguimiento creado', '{"follow_up_status":"CONTROL_PROGRAMADO"}'::jsonb,
    '2026-08-22T11:05:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
    'referral.created', 'Referencia creada', '{"referral_status":"SOLICITADA"}'::jsonb,
    '2026-08-23T11:05:00Z'
  );
