# Known Issues

## Fase 2

- Las migraciones Supabase no fueron ejecutadas contra una instancia local o hosted dentro de este entorno.
- Las pruebas SQL en `supabase/tests` documentan escenarios RLS, pero aun no forman parte de una suite automatizada de CI.
- La auditoria de pacientes se registra desde el servicio frontend; una interrupcion entre mutacion y auditoria podria dejar eventos incompletos. Recomendacion futura: RPC o triggers transaccionales.
- `supabase/seed.sql` crea clinicas y pacientes ficticios, pero no crea usuarios Auth ni membresias porque dependen de Supabase Auth.
- La gestion visual completa de usuarios e invitaciones sigue pendiente; Fase 2 asume que el usuario ya tiene membresia activa.
- No hay estrategia offline para pacientes. La beta permanece online-first para evitar almacenamiento local inseguro de datos sensibles.
