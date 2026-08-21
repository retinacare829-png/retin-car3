# Plan de Desarrollo

## Fase 0 - Fundacion

Estado: completada.

Objetivo:

- Auditar estado inicial.
- Inicializar frontend React/TypeScript/Vite.
- Configurar calidad de codigo, pruebas, build y escaneo de secretos.
- Documentar arquitectura, seguridad, producto, intended use y plan.
- Preparar contrato beta para futura IA sin diagnostico.

Entregado:

- Estructura base de aplicacion.
- Pantalla inicial informativa de Fase 0.
- Contratos de roles/permisos.
- `RetinalAnalysisService` con implementacion beta `NOT_AVAILABLE`.
- Documentacion inicial.
- `.env.example`.
- Script local `secret:scan`.
- Verificaciones finales: tests, typecheck, lint, build, audit y secret scan pasan.
- Audit final: 0 vulnerabilidades.

No incluido:

- Autenticacion.
- Organizaciones persistidas.
- Supabase.
- Pacientes.
- Screenings.
- Carga de imagenes.
- Reportes PDF.
- IA.

## Fase 1 - Autenticacion y organizaciones

Pendiente de autorizacion explicita.

Alcance:

- Configurar Supabase.
- Auth.
- Organizaciones.
- Perfiles.
- Membresias.
- Roles.
- RLS.
- Pruebas de aislamiento multi-tenant.

## Fase 2 - Pacientes

Pendiente.

## Fase 3 - Screening e imagenes

Pendiente.

## Fase 4 - Revision profesional y seguimiento

Pendiente.

## Fase 5 - Dashboard, historial y reporte

Pendiente.

## Fase 6 - Beta para presentacion clinica

Pendiente.
