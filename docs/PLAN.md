# Plan de Desarrollo

## Fase 0 - Fundacion

Estado: completada.

Objetivo:

- Auditar estado inicial.
- Inicializar frontend React/TypeScript/Vite.
- Configurar calidad de codigo, pruebas, build y escaneo de secretos.
- Documentar arquitectura, seguridad, producto, intended use y plan.
- Preparar contrato beta para futura IA sin diagnostico.

Entregado:

- Estructura base de aplicacion.
- Pantalla inicial informativa de Fase 0.
- Contratos de roles/permisos.
- `RetinalAnalysisService` con implementacion beta `NOT_AVAILABLE`.
- Documentacion inicial.
- `.env.example`.
- Script local `secret:scan`.
- Verificaciones finales: tests, typecheck, lint, build, audit y secret scan pasan.
- Audit final: 0 vulnerabilidades.

No incluido:

- Autenticacion.
- Organizaciones persistidas.
- Supabase.
- Pacientes.
- Screenings.
- Carga de imagenes.
- Reportes PDF.
- IA.

## Fase 1 - Autenticacion y organizaciones

Estado: completada.

Alcance:

- Configurar Supabase.
- Auth.
- Organizaciones.
- Perfiles.
- Membresias.
- Roles.
- RLS.
- Pruebas de aislamiento multi-tenant.

Entregado:

- Cliente Supabase para Auth con sesion persistente.
- Pantalla de inicio de sesion y recuperacion de contrasena.
- Estado de configuracion cuando faltan variables de Supabase.
- Consola inicial de organizacion para usuarios autenticados.
- Seleccion de organizacion activa cuando el usuario pertenece a mas de una clinica.
- Migracion SQL para `organizations`, `profiles` y `organization_members`.
- Roles `clinic_admin`, `technical_staff` y `authorized_professional`.
- Politicas RLS para lectura y administracion acotadas por membresia activa.
- Pruebas TypeScript de permisos y aislamiento multi-tenant.
- Archivo SQL de casos de prueba multi-tenant para entorno Supabase local.

No incluido:

- Pacientes.
- Screenings.
- Imagenes.
- Auditoria funcional de entidades clinicas.
- Invitaciones por correo o gestion visual completa de usuarios.
- Datos demo.

## Fase 2 - Pacientes

Estado: completada.

Alcance:

- Listado de pacientes.
- Busqueda y filtros.
- Creacion.
- Edicion.
- Soft delete mediante archivado.
- Validaciones.
- Permisos.
- Auditoria.
- Preparacion de historial futuro.

Entregado:

- Tabla `patients` con datos de identidad y campos clinicos minimos solicitados.
- Soft delete con `deleted_at` y `deleted_by`.
- Tabla `audit_logs` para operaciones sensibles de pacientes.
- Tabla `patient_timeline_events` para preparar historial futuro sin screenings.
- RLS multi-tenant para lectura y escritura de pacientes.
- CRUD de pacientes desde la consola de organizacion.
- Busqueda por identificador, expediente, nombres y apellidos.
- Filtros por sexo, tipo de diabetes y estado archivado.
- Validaciones compartidas con `zod`.
- Seeds ficticios en `supabase/seed.sql`.
- Pruebas unitarias de validacion, filtros, cambios auditables y aislamiento.

No incluido:

- Screenings.
- Carga de imagenes.
- Reportes.
- IA.
- Historial clinico completo con estudios.
- Ejecucion real de migraciones en Supabase local/hosted dentro de este entorno.

## Fase 3 - Screening e imagenes

Estado: completada.

Alcance:

- Crear screenings vinculados a organizacion, paciente, usuario creador y revisor responsable opcional.
- Gestionar estados no diagnosticos del flujo beta.
- Cargar, reemplazar, visualizar y marcar eliminacion logica de imagenes OD/OI.
- Preparar almacenamiento privado para Supabase Storage.
- Registrar calidad manual de imagen con motivos y sugerencia de repetir captura cuando sea inadecuada.
- Mantener IA desacoplada y no disponible en beta.
- Agregar timeline del paciente para eventos de screenings e imagenes.
- Registrar auditoria sin texto clinico libre innecesario.

Entregado:

- Dominio `screening` con estados `BORRADOR`, `CAPTURA_PENDIENTE`, `IMAGENES_COMPLETAS`, `PENDIENTE_REVISION`, `REVISADO`, `SEGUIMIENTO_REQUERIDO` y `CERRADO`.
- Tablas `screenings`, `retinal_images` e `image_quality_reviews`.
- RLS multi-tenant para screenings, imagenes, calidad y Storage privado.
- Servicio `ScreeningService` con manejo de Storage privado, URLs firmadas, auditoria y timeline.
- Hook `useScreenings` y UI integrada en gestion de pacientes.
- Visor OD/OI con zoom, metadatos basicos, descarga autorizada y estado de calidad.
- Datos demo ficticios con varios screenings, imagenes placeholder y estados distintos.
- Pruebas unitarias de dominio para estados, calidad y ausencia de estados diagnosticos.

No incluido:

- Diagnostico clinico.
- Estados diagnosticos.
- Clasificaciones de retinopatia.
- Redes neuronales o inferencia IA.
- Reportes PDF.
- Camaras.
- Seguimiento clinico de Fase 4.

## Fase 4 - Revision profesional y seguimiento

Estado: completada.

Entregado:

- Revision profesional manual con estados operativos y observaciones estructuradas.
- Seguimientos y referencias sin integraciones ni notificaciones externas.
- Checklist de cierre con validacion equivalente en dominio y PostgreSQL.
- Cierre reservado para `clinic_admin` y `authorized_professional`.
- Timeline y auditoria de eventos sensibles sin copiar texto clinico libre a metadata.
- RLS multi-tenant, seeds ficticios y pruebas de dominio, permisos y servicio.

No incluido:

- Diagnostico, inferencia o clasificacion automatizada.
- Reportes PDF, dashboard avanzado, recordatorios o integraciones externas.
- Renovacion visual de Fase 4.5.

## Fase 4.5 - UX + Demo Clinica

Estado: completada.

Entregado:

- Layout clínico responsive con sidebar, encabezado, organización, usuario, rol y cierre de sesión.
- Navegación activa para Inicio, Pacientes, Screenings, Workflow Clínico, Pendientes y Configuración básica.
- Inicio operativo con accesos rápidos, sin gráficas ni estadísticas inventadas.
- Sistema visual unificado para acciones, tarjetas, formularios, estados, errores y carga.
- Estados vacíos para pacientes, screenings, imágenes, revisiones, seguimientos, referencias, timeline e IA.
- Confirmaciones antes de archivar fichas/screenings, retirar imágenes y cerrar screenings.
- Accesibilidad y responsive design priorizados para escritorio y tablet.
- Carga diferida del workspace autenticado y del módulo clínico pesado.
- Recorrido actualizado en `docs/DEMO_CLINICA.md`.

No incluido:

- IA, diagnóstico, clasificación automática, PDF, dashboard avanzado, integraciones o nuevas entidades clínicas.

## Fase 4.6 - Validacion Supabase + QA tecnico

Estado: completada y validada contra Supabase local el 2026-08-28.

Entregado:

- Migracion aditiva para integridad referencial multi-tenant.
- Cierre atomico mediante RPC con rol, checklist, auditoria y timeline.
- Politicas endurecidas para Storage privado y parseo seguro de rutas.
- Seeds ficticios para administrador, tecnico, profesional, segunda clinica, suspendido y usuario sin organizacion.
- Prueba SQL transaccional de RLS y aislamiento.
- Smoke test HTTP para Auth, roles, tenants y Storage opcional.
- Scripts de preflight, reset y QA con npm.
- Runbook local/demo y matriz de QA.

No incluido:

- Funcionalidades nuevas, IA, PDF, dashboard avanzado o cambios visuales.
- Despliegue a proyecto hospedado; esta validación fue exclusivamente local.

## Fase 5 - Dashboard ejecutivo y operativo

Estado: completada.

Entregado:

- Resumen diario y KPIs reales consultados por organización bajo RLS.
- Gráficas de screenings por mes y estados sin dependencia pesada adicional.
- Actividad reciente basada en Timeline y agenda de seguimientos/revisiones.
- Header ejecutivo, navegación por rol y acciones rápidas sin duplicar módulos.
- Diseño RetinaCare responsive, accesible y compatible con reducción de movimiento.

No incluido:

- IA, diagnóstico, reportes PDF, nuevas entidades o cambios en lógica clínica.

## Fase 5.5 - Pulido para demostración

Estado: completada.

Entregado:

- Dashboard y módulos clínicos sincronizados mediante invalidación selectiva.
- KPIs, actividad, agenda y Timeline derivados exclusivamente de Supabase.
- Estados vacíos, placeholders de carga, notificaciones y errores consistentes.
- Prevención de doble envío, validaciones visibles, ordenamiento y paginación.
- Revisión de foco, controles accesibles y paleta RetinaCare existente.

No incluido:

- IA, PDF, funcionalidades clínicas nuevas o cambios de seguridad y workflow.
- Fase 6, que permanece pendiente.

## Fase 6 - Beta para presentacion clinica

Pendiente.
