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

- No hay repositorio Git local dentro de `RetinaCare`; Git detecta un repositorio padre.
- No hay backend ni RLS implementado todavia.
- No hay almacenamiento privado implementado todavia.
- La PWA aun no tiene estrategia offline segura.
