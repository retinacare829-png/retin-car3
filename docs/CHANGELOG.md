# Changelog interno

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
