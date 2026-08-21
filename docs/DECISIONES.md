# Decisiones Tecnicas

## 0001 - Inicializar Vite React TypeScript

Decision: usar React, TypeScript estricto y Vite para la beta.

Motivo: permite una interfaz profesional demostrable, pruebas rapidas y evolucion incremental hacia Supabase sin acoplarse a un backend prematuro.

## 0002 - Supabase como backend recomendado

Decision: documentar Supabase como backend objetivo para Fase 1.

Motivo: Auth, PostgreSQL, RLS y Storage privado cubren multi-tenant, seguridad base y almacenamiento de imagenes sin construir infraestructura propia desde cero.

## 0003 - IA como frontera desacoplada

Decision: crear `RetinalAnalysisService` y una implementacion beta que solo devuelve `NOT_AVAILABLE`.

Motivo: prepara el contrato futuro sin simular diagnostico ni generar resultados clinicos ficticios.

## 0004 - No inicializar Git local

Decision: no ejecutar `git init` en `RetinaCare`.

Motivo: la instruccion del proyecto prohibe inicializar Git si ya existe. La auditoria encontro un repositorio padre en `C:\Users\Mayno`, no uno local; se reporta como riesgo para que el usuario decida.
