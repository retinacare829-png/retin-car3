# Supabase — setup local y demo

## Requisitos

- Node.js y npm compatibles con el proyecto.
- Docker Desktop activo.
- Supabase CLI, ejecutable sin instalación global mediante `npx supabase`.

No se requieren ni deben versionarse credenciales administrativas del backend.

## Inicio local

1. Instalar dependencias con `npm ci`.
2. Iniciar servicios con `npx supabase start`.
3. Aplicar migraciones y seeds ficticios con `npm run supabase:reset`.
4. Consultar credenciales locales con `npx supabase status`.
5. Copiar `.env.example` a `.env` y configurar:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key local>
VITE_APP_ENV=local
```

6. Ejecutar `npm run dev`.

El reset aplica todas las migraciones y luego `supabase/seed.sql`. No ejecutar el seed local contra producción.

## Usuarios ficticios locales

Las cuentas usan dominios `example.test` y la contraseña local compartida definida en `supabase/seed.sql`.

| Cuenta | Rol/contexto |
| --- | --- |
| `admin.demo@example.test` | Administrador de Clínica A |
| `tecnico.demo@example.test` | Personal técnico de Clínica A |
| `profesional.demo@example.test` | Profesional autorizado de Clínica A |
| `admin.clinica-b@example.test` | Administrador aislado de Clínica B |
| `suspendido.demo@example.test` | Membresía suspendida |
| `sin.clinica.demo@example.test` | Usuario autenticado sin organización |

Las identidades email se crean junto con `auth.users`; sus campos de token se inicializan con cadenas vacías para compatibilidad con GoTrue local. El login con contraseña funciona después del reset local. La recuperación puede verificarse en el capturador de correo que muestra `npx supabase status`.

## Migraciones y aislamiento

Las migraciones de validación y endurecimiento agregan controles sin reescribir migraciones históricas:

- claves foráneas compuestas por organización, paciente y screening;
- coherencia completa de imágenes y revisiones de calidad;
- timeline vinculado al paciente del mismo tenant;
- permisos explícitos sobre funciones auxiliares;
- políticas de Storage con parseo seguro del UUID de organización;
- RPC `register_retinal_image` para resolver altas y reemplazos sin violar el índice de lateralidad activa;
- RPC `close_screening_workflow` para cierre, revisión, auditoría y timeline en una transacción.

La migración `202610050001_harden_retinal_uploads.sql` añade validación de nombre, MIME, ruta privada y tamaño máximo de 15 MiB en `register_retinal_image`, además de eliminación controlada para personal autorizado.

El RPC rechaza usuarios anónimos, personal técnico, screenings incompletos, registros cerrados y combinaciones incoherentes.

## Storage privado

- Bucket: `retinal-images-private`.
- Visibilidad: privada (`public = false`).
- Tamaño máximo: 15 MiB.
- MIME permitidos: JPEG, PNG y WebP.
- Ruta: `<organization_id>/<patient_id>/<screening_id>/<OD|OI>/<timestamp>.<extension>`.
- Lectura: miembro activo de la organización correspondiente.
- Subida: `clinic_admin` o `technical_staff` activo.
- Reemplazo: objeto nuevo y fila anterior marcada `REEMPLAZADA`.
- Eliminación: lógica; el objeto permanece privado para trazabilidad.
- URL firmada: 300 segundos por defecto.
- Acceso público directo: no permitido.

## Registro y apariencia de clínicas

Un administrador de clínica autenticado puede abrir **Configuración → Registrar otra clínica**. El registro usa `register_clinic`: crea la nueva organización y su primera membresía de administrador en una sola transacción, y después la selecciona en la interfaz. El personal técnico y el profesional autorizado no pueden registrar clínicas. Para la primera clínica de una instalación nueva se requiere el aprovisionamiento inicial de un administrador; esta pantalla no es un registro público ni permite crear una organización sin una membresía administrativa previa.

En **Configuración → Apariencia** el administrador puede elegir entre cuatro paletas y subir el logotipo de su clínica. El logo de la clínica aparece en el panel lateral y el de RetinaCare queda en la barra superior. La paleta se guarda en la organización y se aplica al cambiar de clínica. El logotipo se guarda en el bucket privado `clinic-branding-private`, bajo `<organization_id>/logo`; solo miembros activos pueden leerlo y solo administradores de esa clínica pueden subirlo o reemplazarlo. Se admiten JPEG, PNG o WebP de hasta 1 MiB; no se admiten SVG.

Para actualizar una base local existente sin eliminar pacientes ni volver a cargar los seeds, ejecute `npx supabase migration up --local` después de revisar las migraciones pendientes. La migración `20261007182138_clinic_branding_registration.sql` añade estos campos, el bucket y sus políticas. La prueba SQL transaccional de la fase está en `supabase/tests/phase_9_clinic_branding_registration.sql` y termina en `ROLLBACK`.

## Validaciones

```bash
npm run supabase:check
npm run supabase:qa:sql
npm run supabase:qa:smoke
```

- `supabase:check` valida archivos y garantías sin conexión.
- `supabase:qa:sql` ejecuta `supabase/tests/phase_6_security_qa.sql` en el contenedor y hace rollback.
- `supabase:qa:smoke` valida Auth, roles, tenants, privacidad, expiración de URL firmada y límite de 15 MiB mediante la API real.

Para validar subida, URL firmada y bloqueo público en un entorno desechable, configure `SUPABASE_QA_ALLOW_STORAGE_MUTATIONS=true`. La prueba carga un PNG técnico de 1 px bajo una ruta `qa-*`; resetee el entorno al finalizar.

## Proyecto hospedado

1. Usar un proyecto demo, nunca producción clínica.
2. Vincularlo mediante `npx supabase link`.
3. Revisar `npx supabase db diff` antes de `npx supabase db push`.
4. Crear cuentas QA ficticias y configurar sus correos en `.env`; no reutilizar el password local.
5. Ejecutar primero el smoke sin mutaciones.
6. Habilitar mutaciones de Storage solo con autorización y datos desechables.

No se realizó `db push` desde esta fase.
