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
