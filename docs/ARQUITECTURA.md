# Arquitectura

## Estado inicial auditado

La carpeta `RetinaCare` contenia un unico activo: `assets/retinacare.jpeg`. No habia aplicacion previa, `package.json`, configuracion TypeScript, backend, documentacion ni migraciones.

Git no esta inicializado dentro de `RetinaCare`; los comandos detectan un repositorio padre en `C:\Users\Mayno`, lo cual se documenta como riesgo operativo. No se ejecuto `git init` por instruccion explicita.

Logo existente:

- Ubicacion: `assets/retinacare.jpeg`
- Formato: JPEG
- Dimensiones: 436 x 178 px
- SHA-256: `9FBF07BE4290BB169E8F9D6AD32D632723858D8D60C158685077457CA311A288`
- Estado: conservado sin modificacion

## Stack seleccionado

- Frontend: React, TypeScript estricto, Vite.
- UI: componentes propios consistentes con iconos `lucide-react`.
- Validacion: `zod` para fases posteriores.
- Testing: Vitest, Testing Library y jsdom.
- Backend recomendado para fases posteriores: Supabase, PostgreSQL, Auth, RLS y Storage privado.
- PWA: manifiesto inicial; service worker queda para una fase posterior con estrategia de seguridad explicita.

## Estructura inicial

- `src/domain`: contratos y reglas puras de dominio.
- `src/components`: componentes de interfaz.
- `src/test`: configuracion de pruebas.
- `docs`: documentacion de producto, arquitectura, seguridad y plan.
- `scripts`: herramientas locales de verificacion.
- `assets`: activos de marca existentes.

## Entidades conceptuales futuras

- `organizations`
- `profiles`
- `organization_members`
- `patients`
- `screenings`
- `retinal_images`
- `image_quality_reviews`
- `professional_reviews`
- `referrals`
- `follow_ups`
- `audit_logs`
- `ai_analysis`

Todas las entidades multi-tenant deberan incluir `organization_id`, UUID, timestamps y politicas RLS que impidan acceso cruzado.

## Frontera de IA

Se creo el contrato `RetinalAnalysisService`. La implementacion beta `BetaRetinalAnalysisService` devuelve exclusivamente `NOT_AVAILABLE`.

Estados conceptuales preparados para futuro:

- `COMPLETED`
- `IMAGE_NOT_INTERPRETABLE`
- `FAILED`
- `REVIEW_REQUIRED`

La beta no genera hallazgos, porcentajes de confianza, diagnosticos ni resultados positivos/negativos.
