# Known Issues

## Fase 2

- Las migraciones Supabase no fueron ejecutadas contra una instancia local o hosted dentro de este entorno.
- Las pruebas SQL en `supabase/tests` documentan escenarios RLS, pero aun no forman parte de una suite automatizada de CI.
- La auditoria de pacientes se registra desde el servicio frontend; una interrupcion entre mutacion y auditoria podria dejar eventos incompletos. Recomendacion futura: RPC o triggers transaccionales.
- `supabase/seed.sql` crea clinicas y pacientes ficticios, pero no crea usuarios Auth ni membresias porque dependen de Supabase Auth.
- La gestion visual completa de usuarios e invitaciones sigue pendiente; Fase 2 asume que el usuario ya tiene membresia activa.
- No hay estrategia offline para pacientes. La beta permanece online-first para evitar almacenamiento local inseguro de datos sensibles.

## Fase 3

- Las migraciones Supabase y politicas de Storage privado no fueron ejecutadas contra una instancia local o hosted dentro de este entorno.
- Los placeholders de imagen en `supabase/seed.sql` son rutas demo; no incluyen objetos binarios reales en Supabase Storage.
- El entorno local no tiene `npm` en PATH. Las verificaciones se ejecutaron con pnpm usando el Node empaquetado de Codex.
- La auditoria de screenings e imagenes se registra desde el servicio frontend; sigue pendiente mover operaciones criticas a RPCs o triggers transaccionales.
- Las politicas RLS validan membresia y rol, pero no reemplazan una revision SQL automatizada en CI.
- La descarga usa URLs firmadas de corta duracion; la expiracion y rotacion fina deberan ajustarse cuando exista entorno Supabase real.

## Fase 4

- La migracion y las pruebas RLS de Fase 4 no se ejecutaron contra una instancia Supabase local u hospedada en este entorno.
- Las mutaciones y sus filas de auditoria/timeline se realizan desde el servicio frontend en operaciones separadas. Una interrupcion puede producir trazabilidad incompleta; deben migrarse a RPCs o triggers transaccionales antes de uso operativo.
- La funcion SQL protege las condiciones minimas de cierre, pero la suite SQL sigue siendo manual y debe integrarse a CI.
- El responsable de seguimiento se captura como UUID mientras no exista el selector visual de miembros de organizacion.
- No existen recordatorios, notificaciones ni integraciones de referencia; son limites deliberados de Fase 4.
- El usuario Auth de `supabase/seed.sql` y todos los registros asociados son exclusivamente ficticios para demo local.

## Fase 4.5

- La navegación del shell usa estado local y no ofrece URLs profundas ni restauración de una pantalla concreta al recargar. Es suficiente para la demo beta; evaluar routing cuando exista esa necesidad.
- Pendientes muestra un estado vacío seguro porque los hooks actuales consultan screenings por paciente y no existe aún una consulta agregada por organización. Implementarla aquí habría ampliado el alcance hacia dashboard.
- La pantalla de inicio no muestra métricas para evitar estadísticas inventadas y consultas agregadas nuevas.
- Los mensajes de servicios se sustituyeron visualmente en puntos principales, pero algunos errores de validación interna siguen dependiendo de los textos existentes de dominio.
- La optimización divide el workspace y el módulo clínico mediante lazy loading. Debe vigilarse el tamaño del chunk clínico conforme crezcan sus componentes.
- La QA se ejecuta contra datos simulados en pruebas de componentes; sigue pendiente una sesión visual completa conectada a una instancia Supabase demo.

## Fase 4.6

- La validación conectada local fue completada el 2026-08-28; migraciones, seeds, SQL RLS, smoke HTTP y recorrido visual pasaron.
- Las operaciones distintas del cierre aún registran mutación, auditoría y timeline desde llamadas separadas. El cierre ya es atómico; migrar el resto a RPC/triggers queda antes de un piloto operativo.
- La eliminación de imágenes es lógica y conserva el objeto privado. Falta una política formal de retención y purga antes de usar datos reales.
- El smoke de Storage deja un objeto `qa-*`; debe ejecutarse en un entorno desechable y seguido de `supabase db reset`.
- La persistencia de sesión fue comprobada con recarga en la aplicación local.
- El transformador de imágenes y el pooler aparecen detenidos en `supabase status`; no afectaron Auth, REST, Storage, Studio ni la matriz de Fase 4.6.
- Las cuentas y contraseña del seed son locales y ficticias. Nunca deben replicarse en un proyecto hospedado.
- Storage se escribe antes de registrar metadata. Si la RPC de imagen falla después de una subida exitosa, puede quedar un objeto privado huérfano; definir limpieza administrativa antes de un piloto.

## Fase 5.6.1

- Resuelto: los placeholders OD/OI del screening demo ahora tienen archivos sintéticos locales y un cargador idempotente para Storage privado.
- Resuelto: el recorrido manual conectado llegó hasta cierre, actualización del Dashboard, Timeline y auditoría el 2026-08-29.
- Las imágenes son ilustraciones generadas y no representan anatomía, hallazgos ni diagnóstico. Deben mantenerse exclusivamente para demo local.
- Después de cada `supabase db reset` es obligatorio ejecutar `npm run demo:storage`, porque el seed SQL no escribe binarios en el backend de Storage.
- Los riesgos operativos no relacionados con la defensa permanecen descritos en Fase 4.6; no se ampliaron funcionalidades ni alcance clínico.
