# RetinaCare: despliegue y evidencia del hackathon

Estado comprobado el **9 de octubre de 2026**. Solo se usan cuentas e imágenes ficticias; la CNN es experimental y **no emite diagnósticos**.

## Estado de los cuatro entregables

| Criterio | Evidencia verificada | Falta comprobar |
| --- | --- | --- |
| 1. URL pública + backend remoto | [retinacare-hackathon.pages.dev](https://retinacare-hackathon.pages.dev/) devuelve HTTPS 200; `/brand/logo.svg` devuelve 200. El bundle `dist-demo` no contiene direcciones Supabase localhost. `https://pdxedkssdwlecpfidmnl.supabase.co/rest/v1/` responde 401 sin credenciales: el servicio remoto está accesible y exige autorización. | Login en la URL final y acceso desde datos móviles de otro dispositivo. |
| 2. Flujo real persistido | Migración `20261009102019_retinal_analysis_reports.sql` aplicada a Supabase hospedado; QA de la migración aprobó 150 comprobaciones locales. La interfaz y los servicios implementan pacientes, screenings, imágenes y aprobación profesional. | Ejecutar desde la URL pública una operación con datos ficticios, recargar y confirmar el mismo registro en Supabase. No se atribuye a una prueba local ese resultado cloud. |
| 3. Documentación de despliegue | Este archivo, comandos de build/republicación y configuración reproducible. `npm run build:demo` compiló con éxito. Despliegue final de producción `eefffeca-2114-435b-8eb5-8bd4e3eddebf`, asociado al commit `f64987d`, visible en Cloudflare Pages. | Repetir build y publicación para cualquier cambio posterior; no usar `dist/` local. |
| 4. Errores y logs | La URL alojada devuelve 404 real para `/no-existe-prueba-404`; cabeceras `nosniff`, `no-referrer` y `DENY`. El servidor local opcional aprobó 14/14 pruebas de errores, protocolos y logs sanitizados. | Verificar en el dashboard de Cloudflare y Supabase eventos/logs correspondientes a una solicitud de prueba; las pruebas del servidor local no son evidencia de logs alojados. |

## Arquitectura y costos para esta demo

La web está en Cloudflare Pages con subdominio gratuito `*.pages.dev`; Auth, PostgreSQL y Storage están en el proyecto Supabase hospedado `pdxedkssdwlecpfidmnl`. La PC y el túnel Quick Tunnel **no participan en esta URL**: se puede apagar la PC y la web sigue publicada. Un navegador móvil accede a la misma web; no se ha generado ni probado un APK. El plan gratuito tiene cuotas y límites de ambos proveedores; revisar su uso en los paneles antes de abrir la demo a muchos evaluadores.

Cloudflare Pages sirve archivos estáticos. `scripts/serve-demo.mjs` no corre en Pages y sus logs no aparecen allí. No atribuir al hosting las garantías específicas de ese servidor local. La CNN TensorFlow.js se descarga al navegador solo al abrir el análisis; su salida se debe presentar como apoyo experimental, con revisión profesional y sin lenguaje diagnóstico.

## Reproducir una publicación

Desde la raíz del repositorio, con Node.js y npm:

```powershell
npm ci
npm run secret:scan
npm run lint
npm run test -- --maxWorkers=2
npm run build:demo
npx --yes wrangler@4.35.0 login
npx --yes wrangler@4.35.0 pages deploy dist-demo --project-name retinacare-hackathon --branch main
```

Antes de `build:demo`, crear localmente `.env.staging` — ignorado por Git — con **solo** `VITE_SUPABASE_URL=https://pdxedkssdwlecpfidmnl.supabase.co`, `VITE_SUPABASE_ANON_KEY` (clave pública/publishable de ese proyecto) y `VITE_APP_ENV=staging`. Esas variables se incorporan al JavaScript público. Nunca poner una service-role key, contraseña, token de acceso ni datos clínicos en `VITE_*`, el repositorio o el chat. El build `dist/` usa el entorno local; publicar únicamente `dist-demo/`.

El nombre `retinacare-hackathon` ya existe en la cuenta Cloudflare autorizada. Para una primera instalación en otra cuenta, crear el proyecto desde Cloudflare Pages antes de `pages deploy`; una cuenta nueva recibirá otro subdominio. El primer despliegue devolvió `https://452e6b8d.retinacare-hackathon.pages.dev`; el despliegue final asociado al commit del repositorio devolvió `https://eefffeca.retinacare-hackathon.pages.dev`. El alias estable es `https://retinacare-hackathon.pages.dev/`.

El flujo de contraseña actual usa la URL de recuperación configurada en Supabase. En **Supabase Dashboard → Authentication → URL Configuration**, configurar `https://retinacare-hackathon.pages.dev` como Site URL y revisar los Redirect URLs antes de demostrar recuperación por correo. No cambiar claves ni políticas Auth solo para hacer funcionar el login: el acceso con email/contraseña no requiere crear cuentas nuevas.

## Prueba de aceptación con datos ficticios

1. Abrir la URL estable en un teléfono con datos móviles, sin Wi-Fi, e iniciar sesión con una cuenta demo que ya tenga membresía y rol en la clínica. No compartir la contraseña.
2. Crear una ficha ficticia; anotar solo el código interno generado, no nombres reales.
3. Crear un screening de esa ficha y confirmar que aparece en la lista. Recargar la página, iniciar sesión de nuevo si hace falta y confirmar que sigue presente.
4. En Supabase Dashboard, buscar el código en la tabla correspondiente y comprobar la marca temporal. Capturar evidencia sin correos, identificadores personales, tokens ni imágenes reales.
5. Cargar una imagen de demostración autorizada, probar OD/OI y verificar que la CNN no se interpreta como diagnóstico. Si se aprueba un anexo, hacerlo con un usuario profesional distinto y confirmar que el portal del paciente muestra solo lo aprobado.
6. Solicitar `/no-existe-prueba-404` (404) y revisar registros del proveedor en Cloudflare y Supabase. No publicar logs crudos con cabeceras, IPs o datos de pacientes.

No marcar el criterio 2 ni los logs alojados del criterio 4 como completos hasta conservar esa evidencia. El APK mediante Capacitor es una segunda fase: empaquetar esta web no aloja la base de datos, no sustituye HTTPS y requiere Android Studio/SDK, build, instalación y prueba real en Android.
