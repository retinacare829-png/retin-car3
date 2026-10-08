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

En **Configuración** el administrador puede subir el logotipo de su clínica. La aplicación calcula los colores a partir de la imagen cada vez que la carga; si no hay logo o no contiene colores utilizables, utiliza la identidad RetinaCare. El logo se muestra completo en el panel lateral, con el nombre de la clínica debajo; hasta que se suba aparece un marcador de logo pendiente. El logo de RetinaCare queda en la barra superior. El logotipo se guarda en el bucket privado `clinic-branding-private`, bajo `<organization_id>/logo`; solo miembros activos pueden leerlo y solo administradores de esa clínica pueden subirlo o reemplazarlo. Se admiten JPEG, PNG o WebP de hasta 1 MiB, entre 96 y 4096 píxeles por lado y una proporción máxima de 5:1; no se admiten SVG. Los campos históricos `brand_theme` permanecen por compatibilidad, pero no controlan la apariencia nueva.

Registrar una clínica no crea usuarios de Auth ni direcciones de correo. Para usuarios reales, soporte debe gestionar invitaciones desde **Authentication → Users** en Supabase Dashboard o con Auth Admin API en un entorno servidor de confianza. Después debe asignarse una membresía y un rol a la clínica correspondiente. Nunca se debe incluir la clave secreta/service role en variables `VITE_*` ni en el navegador.

La configuración local de demostración todavía permite `enable_signup = true`; esta pantalla no ofrece alta pública, pero la API de Auth sí podría aceptar nuevas cuentas sin membresía. Antes de operar como sistema solo por invitación, soporte debe desactivar el registro libre en el proyecto hospedado y probar el flujo de invitación y asignación de membresía. No se cambió esa política de Auth en esta mejora visual.

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

Para abrir la demo desde otros celulares o laptops, **no** publique Supabase local en la red. Su stack local usa `127.0.0.1:54321`: en otro equipo esa dirección apunta al propio dispositivo y fallan Auth, pacientes y Storage, aunque la página de Vite cargue. La [documentación oficial](https://supabase.com/docs/guides/local-development/cli-workflows) advierte que el stack local no está endurecido para tráfico externo.

1. Cree un proyecto **separado de demostración** en Supabase Dashboard, bajo la organización que el responsable del proyecto elija. Use solamente datos e imágenes ficticios. Guarde su contraseña de base de datos fuera del repositorio.
2. Desde este repositorio, instale o utilice Supabase CLI y ejecute `supabase login`, `supabase link --project-ref <ID_DEL_PROYECTO>` y `supabase migration list --linked`. Revise el historial y las migraciones pendientes antes de aplicar nada. En un proyecto nuevo y vacío, `supabase db push --linked` aplica las migraciones; [Supabase documenta esa diferencia](https://supabase.com/docs/guides/local-development/cli-workflows). **No use `supabase db reset --linked`**: reconstruye el esquema remoto y puede eliminar datos.
3. El archivo `supabase/seed.sql` es **solo local**. No lo suba al proyecto hospedado ni copie sus contraseñas ficticias. Cree cuentas de prueba mediante Authentication → Users o una herramienta de aprovisionamiento servidor, y asigne membresías/roles antes de entrar a la app. La pantalla de RetinaCare tiene **inicio de sesión, no registro público de usuarios**. Desactive el registro libre en el proyecto demo si funcionará por invitación.
4. Copie `.env.example` a `.env` y ponga `VITE_SUPABASE_URL=https://<ID_DEL_PROYECTO>.supabase.co` y la **publishable key** (o anon key) en `VITE_SUPABASE_ANON_KEY`; `VITE_APP_ENV=staging`. Reinicie Vite tras cambiar `.env`. Nunca ponga secret key ni service role en `VITE_*`.
5. En Authentication → URL Configuration, establezca la URL real de la web como Site URL y agregue las URLs de retorno necesarias para recuperación de contraseña. Si la web solo se comparte temporalmente por LAN, agregue la URL exacta `http://<IP_DE_TU_PC>:5173` para esa prueba. [Guía de redirecciones](https://supabase.com/docs/guides/auth/redirect-urls).
6. Para servir **solo la web** a otros equipos de la misma Wi‑Fi ejecute `npm run dev:lan` y abra `http://<IP_DE_TU_PC>:5173` (por ejemplo, `http://192.168.0.30:5173`). Autorice el puerto 5173 solo en la red privada de Windows si el firewall lo bloquea. El backend seguirá hospedado y protegido por Auth/RLS; no reenvíe 54321, 54322 ni 54323. Para acceso fuera de la Wi‑Fi, despliegue la web en un hosting HTTPS en vez de reenviar el servidor de desarrollo.
7. Verifique con una cuenta demo desde otro dispositivo: inicio de sesión, listado de pacientes, creación de una ficha ficticia y aislamiento entre clínicas. Revise también `npm run supabase:qa:smoke` con credenciales QA independientes y sin mutaciones de Storage primero.

Estado de la demo (7 de octubre de 2026): el proyecto hospedado **RetinaCare Hackathon** (`pdxedkssdwlecpfidmnl`) está activo; se aplicaron las migraciones de `supabase/migrations/` hasta `20261008042106_harden_demo_rpc_permissions.sql` y el historial remoto conserva los mismos números de versión que los archivos. Todas las tablas de `public` tienen RLS. La primera cuenta fue creada desde Authentication → Users y quedó asociada como administradora activa de **Clínica Demo RetinaCare**; la consulta de RLS como ese usuario ve exactamente una clínica y su membresía. Falta comprobar el inicio de sesión desde un navegador externo antes de considerar lista la demo.

Para compilar sin alterar el `.env` local, use un `.env.staging` ignorado por Git con `VITE_SUPABASE_URL=https://pdxedkssdwlecpfidmnl.supabase.co`, la clave **publishable** en `VITE_SUPABASE_ANON_KEY` y `VITE_APP_ENV=staging`. Compile con `npm run build:demo`. **No use `npm run build` para el túnel:** ese comando toma `.env` y puede generar una página que apunta al Supabase local. No copie contraseñas, claves secretas ni datos reales a ese archivo.

El `git push` del código no despliega la web por sí mismo ni aplica futuras migraciones remotas.

## Enlace temporal para un hackatón

Si los evaluadores están en la misma Wi‑Fi, basta con el paso 6 anterior. Para evaluadores en otras redes, puede publicarse **solo el frontend compilado** mediante un Quick Tunnel gratuito de Cloudflare. Primero compruebe que la app ya usa `https://<proyecto>.supabase.co` y que las pruebas de Auth, pacientes y RLS pasan con datos ficticios. No apunte el túnel a Supabase local ni a los puertos 54321–54323.

En Windows, descargue `cloudflared.exe` desde la [página oficial](https://developers.cloudflare.com/tunnel/downloads/) y compruebe su firma. En una terminal ejecute `npm run build:demo` y luego `python -m http.server 4173 --bind 127.0.0.1 --directory dist`. En otra terminal ejecute `cloudflared tunnel --url http://127.0.0.1:4173`. Comparta únicamente la URL HTTPS `trycloudflare.com` que aparezca; si la URL cambia, actualice la URL de Auth para recuperación de contraseña. El enlace deja de funcionar al cerrar el túnel o apagar el equipo. [Cloudflare indica](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/) que Quick Tunnels son para pruebas y no tienen garantía de disponibilidad.

La opción de APK/Capacitor no resuelve la conectividad de la base de datos: también necesitaría Supabase hospedado. Para la demo inmediata, el navegador móvil evita el trabajo adicional de empaquetado, firma e instalación.
