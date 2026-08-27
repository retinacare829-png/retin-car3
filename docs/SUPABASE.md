# Supabase - Fase 1

## Configuracion local

1. Crear un proyecto Supabase o levantar Supabase local.
2. Aplicar la migracion:

```bash
supabase db reset
```

3. Configurar variables en `.env`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=local
```

No versionar `.env`.

## Migracion incluida

`supabase/migrations/202608200001_phase_1_auth_organizations.sql`

Incluye:

- Enum `organization_role`.
- Enum `organization_member_status`.
- Tabla `organizations`.
- Tabla `profiles`.
- Tabla `organization_members`.
- Funciones `is_org_member` y `has_org_role`.
- RLS para aislamiento por organizacion.
- Trigger para crear perfil al registrarse un usuario en Supabase Auth.

## Pruebas de aislamiento

`supabase/tests/phase_1_multi_tenant_isolation.sql` documenta los casos que deben ejecutarse cuando exista una instancia local/CI con Supabase CLI.

Las pruebas TypeScript actuales cubren la matriz de aislamiento de dominio sin conectarse a una base real.
