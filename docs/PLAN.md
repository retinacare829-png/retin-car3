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

Pendiente de autorizacion explicita.

## Fase 4 - Revision profesional y seguimiento

Pendiente.

## Fase 5 - Dashboard, historial y reporte

Pendiente.

## Fase 6 - Beta para presentacion clinica

Pendiente.
