# Changelog interno

## v0.7.2 - Modo demo para defensa Fase 5.6

- Tarjeta de recorrido sugerido en el Dashboard, sin mutaciones ni datos sensibles.
- Guía completa de defensa, credenciales locales ficticias, mensajes clave, preguntas frecuentes y planes de contingencia.
- Checklist operativo pre-defensa con comandos y verificaciones del flujo completo.
- Seguimiento demo relativo al día del seed y validación idempotente de campos opcionales del workflow.
- QA visual conectado documentado con limitaciones explícitas de Storage y confirmación final.
- Sin IA, PDF, cambios de RLS, migraciones, arquitectura o paleta.

## v0.7.1 - Pulido comercial Fase 5.5

- Invalidación selectiva entre pacientes, screenings, workflow y Dashboard, sin recargar la aplicación.
- Mensajes unificados de éxito y error con tratamiento amigable de red, timeout y permisos.
- Carga mediante placeholders, estados vacíos con contexto y validación visible en formularios.
- Ordenamiento y paginación de pacientes, con controles accesibles por teclado.
- Agenda restringida a seguimientos del día y datos operativos reales desde Supabase.
- Sin cambios en RLS, roles, Storage, auditoría, workflow, IA o PDF.

## v0.7 - Dashboard ejecutivo y operativo

- Dashboard por organización con resumen del día, cinco KPIs y agenda cronológica calculados desde Supabase.
- Gráficas ligeras para screenings mensuales y distribución por estado, con equivalentes textuales accesibles.
- Actividad reciente reutilizando `patient_timeline_events`, sin duplicar eventos ni datos clínicos.
- Header ampliado con logo, clínica, usuario, fecha, búsqueda, notificaciones y menú de sesión.
- Navegación y acciones rápidas ajustadas por permisos, con responsive móvil y animaciones reducidas cuando el sistema lo solicita.
- Sin IA, diagnóstico, PDF, nuevas entidades ni cambios en RLS o workflow clínico.

## v0.6.1 - Validación conectada Fase 4.6

- Validación local completa de migraciones, seeds, Auth, RLS, multi-tenant, Storage, workflow, timeline y auditoría.
- Seed Auth compatible con GoTrue local al evitar tokens nulos.
- QA SQL ajustada para comprobar auditoría con su rol lector autorizado.
- Smoke ampliado con expiración de URL firmada y rechazo de archivos mayores de 15 MiB.
- Secret scan excluye artefactos locales generados bajo `supabase/.temp`.

## v0.6.1 - Validacion Supabase + QA tecnico

- Integridad multi-tenant reforzada con claves compuestas.
- Cierre clínico transaccional mediante RPC PostgreSQL.
- Reemplazo de metadata de imagen transaccional, respetando una lateralidad activa.
- Storage privado endurecido y rutas validadas por organización/paciente/screening/lateralidad.
- Seeds locales para roles, segunda clínica, membresía suspendida y usuario sin organización.
- Prueba SQL RLS, smoke HTTP y scripts npm de validación.
- Documentación para levantar y validar Supabase local/demo.

## v0.6 - UX + Demo Clinica

- Layout clínico coherente con navegación, identidad, contexto de organización, usuario y rol.
- Inicio operativo con accesos rápidos y recorrido de demo sin métricas inventadas.
- Estados vacíos, carga, error, badges y confirmaciones sensibles reutilizables.
- Mejoras responsive y de accesibilidad para escritorio, tablet y móvil básico.
- Carga diferida del workspace autenticado y del módulo clínico para reducir el bundle inicial.
- Guion de demostración clínica actualizado; IA permanece explícitamente no disponible.

## v0.5 - Workflow clinico

- Revision profesional manual con observaciones estructuradas no diagnosticas.
- Seguimientos, referencias, checklist de cierre, permisos por rol, auditoria y timeline.
- Cierre protegido en UI y RLS; IA permanece en `NOT_AVAILABLE`.

## v0.4 - Screenings e imagenes

- Screenings, imagenes privadas OD/OI, calidad manual, auditoria y timeline.

## v0.3 - Gestion de pacientes

- CRUD, validaciones, archivado logico, busqueda y aislamiento por organizacion.

## v0.2 - Autenticacion y organizaciones

- Supabase Auth, perfiles, membresias, roles y RLS multi-tenant.

## v0.1 - Fundacion

- React, TypeScript, Vite, pruebas, documentacion y frontera de IA no disponible.
