-- Fase 4: ejecutar en Supabase local despues de crear usuarios y membresias de prueba.
-- Cada bloque debe ejecutarse con request.jwt.claim.sub del usuario indicado.

-- Caso A: clinic_admin y authorized_professional de la organizacion pueden insertar
-- professional_reviews, follow_ups y referrals con organization_id/patient_id/screening_id coherentes.

-- Caso B: technical_staff puede seleccionar las tres tablas, pero los INSERT/UPDATE
-- de professional_reviews, follow_ups y referrals deben fallar por RLS.

-- Caso C: technical_staff no puede actualizar public.screenings.status a CERRADO.
-- Debe fallar tambien para clinic_admin/professional cuando
-- public.screening_closure_requirements_met(screening_id) devuelve false.

-- Caso D: una membresia de otra organizacion no puede seleccionar ni modificar filas
-- de workflow, aun con UUID conocido.

-- Caso E: ninguna funcion dispone de DELETE fisico. Las tablas conservan deleted_at y
-- deleted_by para una futura operacion de archivado controlado.

select public.screening_closure_requirements_met('30000000-0000-4000-8000-000000000002'::uuid)
  as closed_demo_has_minimum_requirements;
