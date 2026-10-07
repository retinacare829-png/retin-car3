-- Fase 7 security follow-up: sequence access is USAGE-only for clients.

revoke all on sequence public.patient_internal_identifier_sequence,
  public.screening_medical_record_code_sequence
from public, anon, authenticated;

grant usage on sequence public.patient_internal_identifier_sequence,
  public.screening_medical_record_code_sequence
to authenticated, service_role;
