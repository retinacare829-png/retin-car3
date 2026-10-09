# Entregables del hackathon: evidencia y pendientes

> Actualización del 9 de octubre de 2026: la sección histórica de abajo describe la auditoría **antes** de publicar. Para el estado vigente y los comandos reproducibles, consulte [Despliegue Cloudflare Pages](DESPLIEGUE_CLOUDFLARE_PAGES.md). No use los estados «pendiente de publicar» de esa auditoría para el pitch.

Fecha de revisión: **2026-10-09**. Rama: `codex/cnn-integration`; HEAD al iniciar la revisión: `544aa58`. Este documento distingue las comprobaciones de esta tarea de las pendientes del proceso principal. La evidencia histórica local no acredita una transacción cloud ni una publicación actual.

## Checklist de los cuatro entregables

| Entregable | Verificado en esta revisión | Pendiente para aprobarlo |
| --- | --- | --- |
| 1. App pública + API/DB remotas | El bundle existente de `dist-demo` apunta a `pdxedkssdwlecpfidmnl.supabase.co`; no se encontró un endpoint Supabase de loopback. El proyecto cloud devuelve `ACTIVE_HEALTHY`. El endpoint REST responde 401 sin credenciales, lo que confirma alcance HTTP, no acceso autorizado a datos. Sites tiene el proyecto registrado, aún sin versiones ni URL live. | Publicación pública terminada, URL HTTPS accesible desde otra red, carga de recursos y login Supabase desde esa URL. |
| 2. Transacción real persistida de extremo a extremo | Hay código y documentación de flujo clínico persistido; no se realizó una escritura remota en esta tarea. | Crear un registro sintético desde la app publicada, obtener éxito de la API, comprobar su fila remota, recargar/volver a iniciar sesión y mostrar el mismo registro. Añadir trazabilidad/auditoría del flujo elegido. Responsable: proceso principal. |
| 3. Comandos y documentación de despliegue | Servidor Node independiente, pruebas y comandos reproducibles en este documento. `build:demo` está configurado como `tsc -b && vite build --mode staging --outDir dist-demo`. | Recompilar los cambios finales; empaquetar/publicar mediante Sites; registrar versión, resultado de despliegue y URL real. El build no se volvió a ejecutar en esta tarea. |
| 4. Peticiones inválidas/404 controlados con logs | **14/14 pruebas Node aprobadas**, sin omisiones, incluyendo errores de disco y protocolo. Smoke local del bundle existente: **43 archivos**, **3 220 506 bytes**, todos HTTP 200 y SHA-256 idéntico al disco; `/healthz` 200 y ruta inexistente 404. | Repetir las pruebas relevantes en el hosting elegido y adjuntar evidencia sanitizada de Sites y Supabase. Los logs locales del servidor Node no acreditan logs del hosting estático. |

- [x] Revisar repositorio y herramientas/cuentas de hosting en modo de solo lectura.
- [x] Implementar `scripts/serve-demo.mjs` y `scripts/serve-demo.node-test.mjs`.
- [x] Confirmar que Vitest no recoge el archivo Node: `vitest list --config vitest.config.ts --filesOnly`, salida 0 y ninguna entrada `serve-demo`.
- [ ] Completar los cuatro criterios cloud de la tabla; no presentar esta revisión como entrega pública terminada.

## Hosting disponible y recomendación

**Primera opción: continuar con el Site ya creado por el proceso principal**, sirviendo el build en la raíz del dominio. Esto encaja con las rutas `/brand/...` de la aplicación y evita introducir otra cuenta de hosting. La consulta de metadatos acredita rol `owner` y disponibilidad de acceso `public`; no acredita publicación.

| Dato de Sites | Evidencia / estado |
| --- | --- |
| ID exacto | `appgprj_6ac8c1092a4881919735a3c67203a0fa` |
| Estado consultado | `active`; `current_user_role=owner`; `access_mode=custom` (privado según el proceso principal). |
| Versiones y URLs actuales | `latest_version_number=0`, `current_live_url=null`, `current_preview_url=null`: **sin publicar** al consultar. `active` indica existencia del proyecto, no que la app esté live. |
| Capacidad de compartir | `available_access_modes=[custom, public]`; el cambio a público y su verificación quedan a cargo del proceso principal. |
| URL esperada comunicada por el proceso principal | [retinacare-hackathon-demo.tealcamel1.chatgpt.site](https://retinacare-hackathon-demo.tealcamel1.chatgpt.site). Es un destino esperado, **no una URL live verificada**; `get_site` devolvió `expected_url=null` en esta revisión. |
| Empaquetado/despliegue | Responsabilidad del proceso principal; esta tarea no registró, publicó ni modificó recursos externos. Reutilizar este ID. |

Alternativa GitHub Pages: el repositorio público `retinacare829-png/retin-car3` es accesible mediante la cuenta conectada `JohnTigerino`, con `pull=true`, `push=true`, `admin=false`. La API pública informó `has_pages=false`; el endpoint Pages y la URL convencional del proyecto devolvieron 404. No hay workflow de Pages en el checkout revisado. No se habilitó Pages ni se probó una escritura.

Pages admite repositorios públicos gratuitos, pero configurar la fuente requiere permisos de administración o mantenimiento. La identidad conectada no acredita ninguno de ellos. Además, la ruta de proyecto `/retin-car3/` requiere revisar `base`, rutas absolutas de marca y manifest; cambiar solo `base` no corrige necesariamente las rutas escritas literalmente en componentes. Véanse [disponibilidad de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [permisos de configuración](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) y [despliegue Vite en Pages](https://vite.dev/guide/static-deploy#github-pages).

No se localizaron `gh`, `vercel`, `netlify` o `wrangler` en PATH, ni variables de token de esos proveedores en el proceso. Esto no demuestra ausencia de sesiones en un navegador o credenciales fuera de PATH. No se leyeron almacenes de credenciales ni se imprimieron secretos. El Quick Tunnel descrito en [SUPABASE.md](SUPABASE.md) sigue siendo una alternativa temporal dependiente del equipo; no acredita hosting persistente.

## Comandos de build, pruebas y ejecución

Requisito del servidor: Node.js 22 o posterior; comprobado aquí con **v24.13.0 en Windows**. El servidor y sus pruebas usan únicamente módulos nativos. Ejecute desde la raíz del repositorio:

```powershell
# Instalación/build finales: pasos para el responsable de la entrega.
npm ci
npm run build:demo

# Suite HTTP independiente de Vitest.
node --test scripts/serve-demo.node-test.mjs

# Previsualización del build cloud; loopback por defecto.
node scripts/serve-demo.mjs
```

`build:demo` usa el modo `staging` y genera `dist-demo/`. La configuración `.env.staging` ya existente apunta al proyecto cloud indicado; es ignorada por Git. Configure los valores de frontend únicamente en el entorno de build autorizado. Las variables `VITE_*` se incorporan al navegador: solo URL y clave pública/publishable, nunca credenciales privilegiadas, contraseñas ni tokens de sesión. Este documento no contiene valores de claves ni copia ningún archivo de entorno.

Al revisar `package.json`, `preview:demo` todavía ejecutaba `python -m http.server`. **Use el comando Node directo de arriba** para obtener los controles descritos aquí. El proceso principal añadirá el script npm para estas pruebas y podrá conectar el preview; este sidecar no modifica `package.json`.

Para un runtime persistente que sí ejecute Node, el comando de arranque es:

```powershell
node scripts/serve-demo.mjs --host 0.0.0.0
```

`PORT` permite usar el puerto asignado por el proveedor; sin él se usa 4173. También se admite `HOST`; `--host` y `--port` tienen precedencia sobre el entorno. `--root` permite seleccionar otro build explícito. La raíz predeterminada se resuelve respecto del script, no del directorio de trabajo. El servidor rechaza un build sin `index.html` regular y raíces con marcadores de fuente/entorno como `.git`, `package.json` o `.env`. `--help` muestra las opciones. Un puerto inválido u ocupado termina con código 1 y un log sanitizado.

Para operación pública con Node se necesita un proceso supervisado y TLS en el proxy/proveedor. El directorio servido debe ser un artefacto confiable e inmutable, sin archivos privados ni escrituras concurrentes. Los controles de symlinks no son un aislamiento frente a un proceso local capaz de reemplazar directorios mientras se sirven archivos. No reconstruya el mismo directorio mientras atiende tráfico; publique un artefacto nuevo y reinicie/cambie de instancia.

### Preparación específica para Sites — ejecución pendiente del proceso principal

1. Reutilizar el ID registrado y preparar una versión de los cambios finales.
2. Ejecutar `npm run build:demo` con la configuración cloud y verificar recursos de marca, manifest y modelo.
3. Empaquetar **esa salida `dist-demo`** en un directorio estático admitido por Sites, por ejemplo `dist` dentro del paquete. No confundirlo con el `dist/` local que podría apuntar a otro backend. Excluir archivos de entorno, credenciales y datos privados del paquete y de la fuente sincronizada.
4. Guardar/publicar con el flujo de Sites del proceso principal. Registrar versión y despliegue solo cuando existan, esperar su estado terminal y verificar el acceso público requerido.
5. Configurar y comprobar las URLs de Auth/recuperación para el origen final. Repetir la transacción del siguiente apartado desde un navegador externo.

En un despliegue **estático** de Sites no se ejecuta `serve-demo.mjs`. Los códigos HTTP, el fallback de la SPA, `/healthz` y la observabilidad quedan determinados por la configuración/runtime de Sites. Si la plataforma responde 200 con `index.html` a una ruta inexistente, el requisito de 404 real sigue pendiente; deberá corregirlo el proceso principal en la configuración o capa que atiende HTTP.

## Contrato del servidor y evidencia local

| Caso | Comportamiento comprobado |
| --- | --- |
| `GET /`, assets, modelo JSON/binario, fuentes y manifest | 200, MIME explícito, tamaño correcto, streaming del archivo. Cache `no-cache` para revalidar HTML y modelo sin asumir nombres versionados. |
| `HEAD` | Mismo estado/tamaño que GET, sin cuerpo, incluso para errores. |
| `/healthz` | JSON 200 del proceso estático; no consulta ni certifica Supabase. |
| Ruta/archivo inexistente, directorio, dotfile, sourcemap, archivo SQL o paquete | JSON 404, sin listado de directorios ni fallback general a HTML. La UI actual navega por estado en `/`. |
| Traversal sin codificar/codificado/doble, separadores codificados, barras Windows, ADS, dispositivos y URL mal formada | 400 antes de normalizar la ruta. Controles lexicales, `lstat`, `realpath`, rechazo de symlinks/junctions y apertura sin seguimiento cuando la plataforma lo admite. |
| Método no soportado / cuerpo en GET o HEAD | 405 con `Allow: GET, HEAD` / 400; cierre de conexión. No procesa uploads ni API clínica. |
| URI larga, cabeceras grandes, `Expect`, HTTP inválido | 414, 431, 417 o 400, según el caso; CONNECT y upgrade también se rechazan. |
| Cliente lento/desconectado | Cabeceras 10 s, petición 15 s, inactividad del socket 30 s y keep-alive 5 s. 408 para cabeceras incompletas; desconexión registrada como 499, sin enviar ese estado al cliente. |
| Error de disco inesperado | 500 genérico con ID generado por el servidor. Si ya comenzó el cuerpo, aborta la transferencia y registra `FILE_READ_FAILED`; no puede cambiar retroactivamente un 200 enviado. |
| Cierre operativo | SIGINT/SIGTERM dejan de aceptar conexiones y conceden hasta 10 s antes de forzar las restantes. Implementado; la señal de cierre debe comprobarse en el runtime final. |

Los logs son JSON por línea en stdout. Cada petición registra únicamente `timestamp`, `event`, `level`, `requestId`, `method` (`GET`, `HEAD` u `OTHER`), `route` (categoría fija), `status`, `code` y `durationMs`. Los errores de protocolo usan un esquema similar sin duración. El ID se genera en el servidor y se devuelve en `X-Request-Id`; no se confía en un ID recibido del cliente. Los eventos operativos registran categorías/códigos y, al escuchar, el puerto.

**No se registran** URLs, rutas solicitadas, query strings, cuerpos, cabeceras, cookies, tokens, nombres de pacientes, IPs, rutas de disco, mensajes arbitrarios de excepciones, stacks ni paquetes HTTP crudos. Las respuestas de error tampoco reflejan esas entradas. Las pruebas inyectan un marcador sintético en esos campos y verifican su ausencia. Las cabeceras `nosniff`, `no-referrer` y `X-Frame-Options: DENY` se aplican a las respuestas. El proxy/CDN puede tener logs propios: esta protección local no configura su política de logging.

Comprobaciones manuales de alcance local, con el servidor iniciado:

```powershell
curl.exe -i http://127.0.0.1:4173/healthz
curl.exe -i http://127.0.0.1:4173/recurso-inexistente
curl.exe --path-as-is -i http://127.0.0.1:4173/%2e%2e/package.json
curl.exe -i -X POST http://127.0.0.1:4173/
```

Estados esperados: 200, 404, 400 y 405. Los mismos casos se ejercitaron mediante la suite automatizada. No envíe datos clínicos ni credenciales en estas solicitudes de prueba.

## Verificación alojada: Sites, Supabase y persistencia

**Todo este apartado permanece pendiente.** Debe completarlo el proceso principal después de publicar, con registros sintéticos. No se ejecutaron transacciones cloud ni se extrajeron logs de usuarios en esta tarea.

| Evidencia a adjuntar | Criterio de aceptación | Estado |
| --- | --- | --- |
| Despliegue Sites | ID de versión/despliegue, fecha UTC, resultado terminal satisfactorio y URL live devuelta por el proveedor. | Pendiente |
| Acceso externo | La URL abre desde otra red/sesión sin depender de una sesión del propietario en Sites. El login clínico de Supabase puede seguir siendo obligatorio. | Pendiente |
| App y recursos | HTML, chunks, `/brand/`, manifest y modelo cargan desde el origen final; no hay solicitudes al Supabase local. | Pendiente |
| Login/Auth cloud | Sesión autorizada en la organización esperada y recuperación/redirecciones compatibles con el origen final. | Pendiente |
| Operación persistida | Crear paciente o screening sintético desde la UI pública; confirmar éxito de la API y fila remota correspondiente; recargar o abrir nueva sesión y recuperar ese mismo registro. | Pendiente |
| Trazabilidad DB | Registrar tabla/operación, ID sintético o referencia sanitizada, marca de tiempo y evento de auditoría esperado. Una captura de toast o una fila sembrada previamente no prueba el recorrido completo. | Pendiente |
| HTTP inválido/404 alojado | Ruta inexistente y petición inválida producen errores HTTP controlados, sin reflejar datos de entrada; no aceptar silenciosamente HTML 200 para todo. | Pendiente |
| Logs Sites | Evidencia de la petición sintética de prueba: fecha, categoría, estado y correlación si están disponibles. Confirmar acceso a logs del runtime/proveedor; si el hosting estático no los expone, registrar ese límite y resolver el requisito de observabilidad con el proceso principal. | Pendiente |
| Logs Supabase | Evidencia sanitizada de Auth/API y del flujo persistido; consultar auditoría de aplicación cuando corresponda. Registrar servicio, fecha, operación/categoría y estado, sin exportar entradas completas. | Pendiente |
| Privacidad de evidencia | Omitir Authorization, cookies, cuerpos clínicos, URLs firmadas, IPs y parámetros sensibles antes de guardar capturas/extractos. Los logs del proveedor no heredan la sanitización del script local. | Pendiente |

Los informes DB/IA y la verificación de sus migraciones pertenecen al proceso principal. Consulte [SUPABASE.md](SUPABASE.md), [QA_SUPABASE.md](QA_SUPABASE.md) e [INTEGRACION_CNN.md](INTEGRACION_CNN.md) para su contexto, sin convertir los resultados históricos en evidencia de la versión pública final.

## Bloqueos actuales y alcance de este sidecar

Faltan publicación y acceso público comprobados; transacción UI → API → DB → recarga; y evidencia sanitizada de errores/logs de Sites y Supabase. El Site está registrado pero sin publicar en la última consulta. El servidor Node y sus controles están verificados localmente; su cobertura no se traslada automáticamente a Sites estático.

Archivos de esta tarea: `scripts/serve-demo.mjs`, `scripts/serve-demo.node-test.mjs` y este documento. No se modificaron por este sidecar `package.json`, frontend, backend o configuración del proveedor; no se hicieron registros, despliegues, commits ni pushes. Las modificaciones paralelas del proceso principal quedan fuera de esta evidencia. La consulta de Supabase se limitó al estado del proyecto y al alcance HTTP sin autenticar; las de GitHub/Sites fueron de solo lectura.
