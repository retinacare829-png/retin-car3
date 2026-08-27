# Seguridad y Privacidad

## Principios

- Privacidad por diseno.
- Minimo privilegio.
- Separacion estricta por organizacion.
- Validacion de entrada.
- Auditoria de acciones sensibles.
- No exposicion publica directa de imagenes.
- No secretos en repositorio.

## Variables de entorno

Se creo `.env.example` con variables publicas esperadas para el cliente. Las claves reales no deben versionarse.

Variables futuras:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Variables privadas del backend o CI, nunca expuestas al cliente.

## Autenticacion y organizaciones

Fase 1 incorpora Supabase Auth con persistencia de sesion en el cliente y politicas RLS en base de datos para organizaciones y membresias.

Controles implementados:

- `organizations` solo visible para miembros activos.
- `organization_members` solo visible dentro de organizaciones donde el usuario es miembro activo.
- Creacion/actualizacion de membresias limitada a `clinic_admin`.
- Membresias `suspended` no conceden acceso.
- Perfiles limitados al usuario autenticado propietario.

Controles pendientes para fases posteriores:

- MFA o politicas avanzadas de contrasena, si el piloto lo requiere.
- Invitaciones seguras por correo.
- Auditoria funcional de administracion de usuarios.
- Pruebas RLS ejecutadas contra una instancia Supabase local/CI.

## Pacientes

Fase 2 incorpora controles para informacion sensible de pacientes aun cuando la beta use datos ficticios.

Controles implementados:

- Separacion por `organization_id`.
- RLS para lectura/escritura de pacientes por membresia y rol.
- Soft delete con `deleted_at` y `deleted_by`; no se elimina fisicamente la fila.
- Auditoria de creacion, actualizacion, archivado y restauracion.
- `audit_logs.metadata` guarda solo conteos/metadatos tecnicos, no notas clinicas.
- Seeds exclusivamente ficticios con dominios `example.test`.

Controles pendientes:

- Pruebas RLS automatizadas contra Supabase real/local.
- Politicas de retencion y borrado legal.
- Cifrado adicional a nivel de aplicacion si el piloto lo exige.
- Reglas de minimizacion de datos por configuracion de clinica.

## Imagenes medicas

En fases posteriores las imagenes deben almacenarse en bucket privado de Supabase Storage o equivalente. El acceso debe ser mediante URLs temporales/firmadas y validacion de permisos por organizacion.

No se debe implementar cache persistente offline de imagenes clinicas sin diseno de cifrado, expiracion y borrado seguro.

## Auditoria

La auditoria registrara usuario, accion, fecha, entidad afectada, ID y tipo de cambio. Debe evitar guardar texto libre clinico sensible cuando baste con metadatos.

Acciones sensibles:

- Creacion o actualizacion de pacientes.
- Carga, reemplazo o eliminacion de imagenes.
- Registro de calidad.
- Revision profesional.
- Cierre o reapertura.
- Cambios de seguimiento o referencia.

## Riesgos actuales

- Las politicas RLS fueron creadas como migracion, pero no se ejecutaron contra una instancia Supabase dentro de este entorno.
- No hay almacenamiento privado implementado todavia.
- La PWA aun no tiene estrategia offline segura.
- La auditoria de pacientes depende de inserciones desde el cliente; en fases posteriores conviene moverla a triggers/RPC transaccionales.
