# Arquitectura

## Estado inicial auditado

La carpeta `RetinaCare` contenia un unico activo: `assets/retinacare.jpeg`. No habia aplicacion previa, `package.json`, configuracion TypeScript, backend, documentacion ni migraciones.

Git fue corregido despues de Fase 0. La Fase 1 se ejecuto sobre la rama `main`, con Fase 0 versionada en el commit `8b3d873`.

Logo existente:

- Ubicacion: `assets/retinacare.jpeg`
- Formato: JPEG
- Dimensiones: 436 x 178 px
- SHA-256: `9FBF07BE4290BB169E8F9D6AD32D632723858D8D60C158685077457CA311A288`
- Estado: conservado sin modificacion

## Stack seleccionado

- Frontend: React, TypeScript estricto, Vite.
- UI: componentes propios consistentes con iconos `lucide-react`.
- Validacion: `zod` para fases posteriores.
- Testing: Vitest, Testing Library y jsdom.
- Backend: Supabase, PostgreSQL, Auth, RLS y Storage privado en fases posteriores.
- PWA: manifiesto inicial; service worker queda para una fase posterior con estrategia de seguridad explicita.

## Estructura inicial

- `src/domain`: contratos y reglas puras de dominio.
- `src/components`: componentes de interfaz.
- `src/test`: configuracion de pruebas.
- `docs`: documentacion de producto, arquitectura, seguridad y plan.
- `scripts`: herramientas locales de verificacion.
- `assets`: activos de marca existentes.

## Entidades conceptuales futuras

- `organizations` implementada en Fase 1.
- `profiles` implementada en Fase 1.
- `organization_members` implementada en Fase 1.
- `patients` implementada en Fase 2.
- `screenings`
- `retinal_images`
- `image_quality_reviews`
- `professional_reviews`
- `referrals`
- `follow_ups`
- `audit_logs` implementada inicialmente en Fase 2 para pacientes.
- `ai_analysis`

Todas las entidades multi-tenant deberan incluir `organization_id`, UUID, timestamps y politicas RLS que impidan acceso cruzado.

## Fase 1 - Autenticacion y organizaciones

Archivos principales:

- `src/lib/supabase.ts`: cliente Supabase tipado, sesion persistente y refresh automatico.
- `src/hooks/useAuthSession.ts`: lectura de sesion, login, recuperacion y cierre.
- `src/hooks/useOrganizationContext.ts`: organizaciones activas del usuario autenticado.
- `supabase/migrations/202608200001_phase_1_auth_organizations.sql`: esquema y RLS.

Modelo de datos:

- `organizations`: datos basicos de clinica.
- `profiles`: identidad de usuario vinculada a `auth.users`.
- `organization_members`: membresia, rol y estado por organizacion.

Reglas RLS base:

- Un usuario autenticado solo lee organizaciones donde tiene membresia activa.
- Solo un `clinic_admin` activo puede actualizar su organizacion.
- Solo un `clinic_admin` activo puede crear o actualizar membresias dentro de su organizacion.
- Un usuario solo puede crear, leer y actualizar su propio perfil.

Limitacion intencional: la administracion visual completa de usuarios queda para iteracion posterior dentro de Fase 1 extendida o una subtarea antes de Fase 2, segun prioridad del producto.

## Fase 2 - Gestion de pacientes

Archivos principales:

- `src/domain/patient.ts`: schema de validacion, tipos, filtros y helper de campos modificados.
- `src/services/patientService.ts`: CRUD, soft delete, auditoria y eventos de timeline.
- `src/hooks/usePatients.ts`: estado de UI y permisos para pacientes.
- `src/components/PatientManagement.tsx`: listado, busqueda, filtros y acciones.
- `src/components/PatientForm.tsx`: creacion y edicion.
- `supabase/migrations/202608210001_phase_2_patients_audit.sql`: modelo de pacientes, auditoria y RLS.
- `supabase/seed.sql`: clinicas y pacientes ficticios para demostracion.

Modelo de datos:

- `patients`: identidad del paciente y datos minimos relacionados con diabetes.
- `audit_logs`: acciones sensibles con metadatos limitados, sin texto clinico libre.
- `patient_timeline_events`: base para historial futuro de eventos del paciente.

Reglas RLS base:

- Miembros activos pueden leer pacientes de su organizacion.
- `clinic_admin` y `technical_staff` pueden crear, editar, archivar y restaurar pacientes.
- `authorized_professional` puede leer pacientes pero no modificarlos.
- El archivado es logico; no se elimina fisicamente la fila.

Separacion conceptual: Fase 2 mantiene identidad del paciente separada de screenings, imagenes y resultados futuros.

## Fase 3 - Screenings e imagenes

Archivos principales:

- `src/domain/screening.ts`: estados de flujo, lateralidad OD/OI, calidad manual, validaciones y constantes beta.
- `src/services/screeningService.ts`: gestion de screenings, imagenes, Storage privado, auditoria y timeline.
- `src/hooks/useScreenings.ts`: estado de UI y permisos para screenings e imagenes.
- `src/components/ScreeningManagement.tsx`: modulo de screenings, visor OD/OI, carga/reemplazo y calidad manual.
- `supabase/migrations/202608270001_phase_3_screenings_images.sql`: modelo relacional, RLS y bucket privado.
- `supabase/tests/phase_3_screening_image_isolation.sql`: escenarios esperados de aislamiento y permisos.

Modelo de datos:

- `screenings`: estudio de tamizaje asociado a organizacion, paciente, creador y revisor opcional.
- `retinal_images`: imagenes OD/OI con ruta privada de Storage, metadatos, hash opcional, estado y eliminacion logica.
- `image_quality_reviews`: evaluacion manual de calidad con estado, motivos no diagnosticos y sugerencia beta.

Reglas RLS base:

- Miembros activos pueden leer screenings, imagenes y revisiones de calidad dentro de su organizacion.
- `clinic_admin` y `technical_staff` pueden crear screenings y cargar/reemplazar imagenes.
- `clinic_admin`, `technical_staff` y `authorized_professional` pueden registrar calidad manual.
- Las imagenes usan bucket privado `retinal-images-private`; el frontend solicita URLs firmadas y no usa rutas publicas.

Timeline y auditoria:

- Eventos nuevos: screening creado/actualizado/cerrado, imagen cargada/reemplazada/eliminada y calidad registrada.
- Metadata limitada a identificadores tecnicos, conteos, estados y lateralidad. No se replica texto clinico libre en auditoria.

Limite clinico: Fase 3 no registra diagnosticos, porcentajes, clasificaciones clinicas ni conclusiones automatizadas.

## Frontera de IA

Se creo el contrato `RetinalAnalysisService`. La implementacion beta `BetaRetinalAnalysisService` devuelve exclusivamente `NOT_AVAILABLE`.

Mensaje visible desde Fase 3: `Módulo de Inteligencia Artificial no disponible en esta versión beta.`

Estados conceptuales preparados para futuro:

- `COMPLETED`
- `IMAGE_NOT_INTERPRETABLE`
- `FAILED`
- `REVIEW_REQUIRED`

La beta no genera hallazgos, scores, diagnosticos ni conclusiones automatizadas.

## Fase 4 - Workflow clinico

Archivos principales:

- `src/domain/clinicalWorkflow.ts`: estados, schemas y checklist de cierre pura.
- `src/services/clinicalWorkflowService.ts`: persistencia, auditoria y timeline.
- `src/hooks/useClinicalWorkflow.ts`: estado de UI y permisos.
- `src/components/ClinicalWorkflow.tsx`: revision, seguimiento, referencia y cierre.
- `supabase/migrations/202608280001_phase_4_clinical_workflow.sql`: tablas, indices, claves, funcion de checklist y RLS.

Modelo de datos:

- `professional_reviews`: una revision activa por screening, criterio manual estructurado y comentarios opcionales.
- `follow_ups`: decisiones y acciones de seguimiento con responsable y fechas opcionales.
- `referrals`: solicitud manual, destino y estado, sin comunicacion externa.

El cierre se valida dos veces: la UI presenta cada requisito faltante y la politica de `screenings` exige que `screening_closure_requirements_met` sea verdadera. La politica separa al personal tecnico de los roles profesionales y bloquea modificaciones posteriores al cierre. Las entidades usan una clave foranea compuesta hacia screening para conservar coherencia entre organizacion, paciente y screening.

## Fase 4.5 - Capa de experiencia clínica

La Fase 4.5 no modifica el modelo de datos ni las fronteras de servicios. Agrega una capa de presentación sobre los módulos existentes:

- `ClinicWorkspace` controla navegación y contexto visual de la sesión sin introducir un router adicional.
- `OperationalHome` ofrece accesos directos basados en acciones; no consulta ni inventa métricas.
- `ui.tsx` centraliza estados vacíos, carga, errores y badges accesibles.
- `App` y `ClinicWorkspace` usan `React.lazy` para separar el shell autenticado y el módulo clínico del bundle inicial.
- Los módulos de pacientes, screenings y workflow conservan sus hooks, servicios, permisos y aislamiento multi-tenant.

La navegación mantiene el contexto paciente → screening → workflow mediante títulos, breadcrumbs y selección explícita de ficha. El sidebar se convierte en panel móvil y el encabezado conserva organización, usuario y rol.
