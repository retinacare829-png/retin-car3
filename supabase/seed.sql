insert into public.organizations (id, name, legal_name, country_code, timezone, contact_email)
values
  ('10000000-0000-4000-8000-000000000001', 'Clinica Demo Oftalmologica', 'Clinica Demo Oftalmologica S.A.', 'NI', 'America/Managua', 'demo-oftalmologia@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'Centro Demo Diabetes', 'Centro Demo Diabetes S.A.', 'NI', 'America/Managua', 'demo-diabetes@example.test')
on conflict (id) do nothing;

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
  )
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
  );
