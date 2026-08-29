# QA Supabase — Fase 4.6

## Estado de esta ejecución

Validación conectada completada el 2026-08-28 contra Supabase local. El reset aplicó todas las migraciones y seeds; la prueba SQL terminó con `QA Supabase Fase 4.6: OK` y el smoke HTTP completó 22 verificaciones.

Se comprobaron Auth, los tres roles, usuarios suspendido/sin organización, aislamiento entre clínicas, Storage privado, subida, URL firmada, expiración, bloqueo público y límite de 15 MiB. En la UI se verificaron login, persistencia tras recarga, cambio de organización con una membresía temporal de QA y logout; la membresía temporal fue retirada al terminar.

No interpretar validación estática como evidencia de RLS real. La prueba SQL válida termina con `QA Supabase Fase 4.6: OK`.

## Preparación

```bash
npm ci
npx supabase start
npm run supabase:reset
npm run supabase:check
npm run supabase:qa:sql
```

Después configure `.env` y ejecute `npm run supabase:qa:smoke`. Para Storage HTTP, habilite `SUPABASE_QA_ALLOW_STORAGE_MUTATIONS=true` solo en local desechable.

## Matriz obligatoria

| Área | Caso | Validador |
| --- | --- | --- |
| Auth | Login de tres roles | Smoke HTTP |
| Auth | Logout y sesión eliminada | Smoke HTTP |
| Auth | Persistencia | Aplicación + recarga manual |
| Auth | Recuperación | Smoke + bandeja local |
| Auth | Sin organización/suspendido | Smoke y SQL |
| Organizaciones | Dos clínicas, roles y membresías | Seed y SQL |
| Pacientes | CRUD, archivo/restauración, búsqueda/filtros | Aplicación local |
| Pacientes | Aislamiento Clínica A/B | SQL y smoke |
| Screenings | Crear/editar y tenant correcto | Aplicación y SQL |
| Imágenes | OD/OI, reemplazo y calidad | Aplicación + Storage |
| Storage | Bucket/ruta privada | Migración y SQL |
| Storage | URL firmada, expiración, límite 15 MiB y URL pública bloqueada | Smoke con mutaciones |
| Workflow | Revisión, seguimiento y referencia | Aplicación y SQL |
| Cierre | Checklist y cierre atómico | SQL/RPC |
| Cierre | Técnico bloqueado/profesional permitido | SQL/RPC |
| Trazabilidad | Auditoría y timeline | SQL/RPC |
| Multi-tenant | Pacientes, screenings e imágenes aislados | SQL |

## QA funcional manual

1. Iniciar como administrador y confirmar organización/rol.
2. Crear un paciente ficticio, editarlo, archivarlo y restaurarlo.
3. Confirmar búsqueda y filtros.
4. Crear screening y cargar OD/OI.
5. Reemplazar una captura y registrar calidad.
6. Abrir mediante URL firmada y confirmar que la URL pública falla.
7. Como profesional, crear revisión, seguimiento o referencia.
8. Cerrar con checklist completo y comprobar timeline/auditoría.
9. Como técnico, confirmar que el cierre es rechazado.
10. Como Clínica B, confirmar ausencia de datos/objetos de Clínica A.
11. Probar membresía suspendida y usuario sin organización.
12. Cerrar sesión, recargar y confirmar ausencia de sesión.

## Evidencia

- Salida de `supabase status` sin claves privadas.
- Salida de `supabase:qa:sql` y `supabase:qa:smoke`.
- Versión de Supabase CLI/Docker y fecha.
- Identificador del proyecto demo, nunca tokens.
- Incidencias sanitizadas, sin datos clínicos.

## Criterio de aprobación

La validación conectada se aprueba solo cuando migraciones/seeds aplican desde cero, SQL y smoke terminan correctamente y el recorrido manual no descubre accesos cruzados ni objetos públicos.
