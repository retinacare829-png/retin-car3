# QA Supabase — Fase 6: Seguridad

## Alcance y evidencia

La validación de Fase 6 separa evidencia estática, SQL transaccional, smoke HTTP y recorrido manual. La suite SQL vigente es `supabase/tests/phase_6_security_qa.sql`; reemplaza el archivo de ejecución anterior en `npm run supabase:qa:sql` y hace `rollback` al terminar.

La salida `QA Supabase Fase 6 Seguridad: OK` es obligatoria para considerar válida la prueba SQL. La salida de `npm run supabase:check` solo demuestra que el repositorio contiene los controles esperados; no sustituye ejecutar RLS contra una instancia Supabase.

La suite HTTP valida Auth, roles, aislamiento de tenants, recuperación de contraseña y, cuando se habilitan mutaciones en un entorno desechable, Storage privado, URLs firmadas, expiración, acceso público bloqueado y el límite de 15 MiB.

## Preparación

```bash
npm ci
npx supabase start
npm run supabase:reset
npm run supabase:check
npm run supabase:qa:sql
```

Después configure `.env` y ejecute `npm run supabase:qa:smoke`. Para Storage HTTP, habilite `SUPABASE_QA_ALLOW_STORAGE_MUTATIONS=true` solo en un entorno local desechable; los objetos se crean bajo rutas `qa-*` y el entorno debe resetearse al finalizar.

## Matriz obligatoria

| Área | Caso | Validador |
| --- | --- | --- |
| Auth | Login de tres roles | Smoke HTTP |
| Auth | Logout y sesión eliminada | Smoke HTTP |
| Auth | Persistencia | Aplicación + recarga manual |
| Auth | Recuperación | Smoke + bandeja local |
| Auth | Sin organización/suspendido | Smoke y SQL |
| Auth | `auth.uid()` y trigger de perfil | SQL transaccional |
| Organizaciones | Dos clínicas, roles y membresías | Seed y SQL |
| Pacientes | CRUD, archivo/restauración, búsqueda/filtros | Aplicación local |
| Pacientes | Aislamiento Clínica A/B | SQL y smoke |
| Screenings | Crear/editar y tenant correcto | Aplicación y SQL |
| Imágenes | OD/OI, reemplazo y calidad | Aplicación + Storage |
| Storage | Bucket/ruta privada | Migración y SQL |
| Storage | URL firmada, expiración, límite 15 MiB y URL pública bloqueada | Smoke con mutaciones |
| Storage | RPC rechaza `size_bytes > 15728640` | SQL transaccional |
| Workflow | Revisión, seguimiento y referencia | Aplicación y SQL |
| Cierre | Checklist y cierre atómico | SQL/RPC |
| Cierre | Técnico bloqueado/profesional permitido | SQL/RPC |
| Trazabilidad | Auditoría y timeline | SQL/RPC |
| Multi-tenant | Pacientes, screenings e imágenes aislados | SQL |
| No diagnóstico | Estados operativos y módulo IA `NOT_AVAILABLE` | SQL y pruebas de dominio |

## Casos cubiertos por la suite SQL de Fase 6

- RLS habilitado en identidad, datos clínicos, imágenes y auditoría.
- Políticas explícitas de lectura, subida y eliminación para el bucket privado.
- Resolución de `request.jwt.claim.sub` y existencia del trigger de perfil de Auth.
- Aislamiento entre Clínica A y Clínica B, incluida la clave foránea compuesta.
- Roles `clinic_admin`, `technical_staff` y `authorized_professional`, con rechazo de creación de paciente por profesional y de revisión/cierre por técnico.
- Membresía suspendida y usuario sin organización sin filas visibles.
- Auditoría visible al administrador del tenant y aislada frente a otros roles/tenants.
- Rechazo en servidor de una imagen de `15728641` bytes, incluso si se invoca el RPC directamente.
- Ausencia de estados persistidos cuyo nombre sugiera diagnóstico automático.

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

La validación conectada se aprueba solo cuando migraciones/seeds aplican desde cero, la suite SQL termina con `QA Supabase Fase 6 Seguridad: OK`, el smoke HTTP termina correctamente y el recorrido manual no descubre accesos cruzados, objetos públicos ni mensajes diagnósticos.
