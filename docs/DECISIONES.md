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

## 0005 - Supabase Auth y RLS desde Fase 1

Decision: implementar autenticacion con `@supabase/supabase-js` y migracion SQL para organizaciones, perfiles y membresias.

Motivo: el aislamiento multi-clinica es un requisito estructural, no una mejora posterior. La beta debe partir de una frontera clara entre organizaciones aun antes de registrar pacientes.

## 0006 - No crear pacientes ni datos demo en Fase 1

Decision: limitar Fase 1 a identidad, organizaciones, roles y politicas.

Motivo: el prompt maestro ordena detenerse despues de Fase 1. Los pacientes pertenecen a Fase 2 y los datos demo a fases posteriores.

## 0007 - Soft delete para pacientes

Decision: archivar pacientes con `deleted_at` y `deleted_by` en lugar de eliminarlos fisicamente.

Motivo: la informacion medica futura requiere trazabilidad, auditoria y recuperacion controlada. La eliminacion fisica debe definirse luego con una politica formal de retencion.

## 0008 - Auditoria inicial desde servicio de aplicacion

Decision: registrar cambios de pacientes desde `PatientService` en `audit_logs` y `patient_timeline_events`.

Motivo: permite cerrar Fase 2 sin introducir RPCs complejas. Se documenta como deuda mover operaciones criticas a funciones SQL transaccionales o triggers cuando la beta se conecte a Supabase real.

## 0009 - Seeds ficticios y no reales

Decision: incluir `supabase/seed.sql` con clinicas y pacientes completamente ficticios.

Motivo: la beta requiere datos de demostracion, pero no debe almacenar ni insinuar datos reales de pacientes o centros.

## 0010 - Screenings sin estados diagnosticos

Decision: modelar los estados de Fase 3 como flujo operativo: `BORRADOR`, `CAPTURA_PENDIENTE`, `IMAGENES_COMPLETAS`, `PENDIENTE_REVISION`, `REVISADO`, `SEGUIMIENTO_REQUERIDO` y `CERRADO`.

Motivo: el modulo debe preparar captura y revision sin emitir diagnostico, clasificacion clinica ni conclusiones automatizadas.

## 0011 - Storage privado con URLs firmadas

Decision: guardar solamente rutas privadas de Supabase Storage en `retinal_images` y generar URLs firmadas desde el servicio cuando el usuario tiene permisos.

Motivo: las imagenes retinales son sensibles y no deben exponerse mediante bucket publico ni rutas compartibles permanentes.

## 0012 - Calidad manual no bloqueante

Decision: registrar calidad en `image_quality_reviews` con motivos no diagnosticos y sugerencia `Repetir captura` cuando el estado es `INADECUADA`, sin impedir guardar el screening.

Motivo: la calidad orienta la operacion de captura, pero no debe bloquear la trazabilidad ni confundirse con una conclusion clinica.

## 0013 - Revision manual estructurada

Decision: guardar banderas operativas en `structured_observations` y texto opcional separado, sin interpretar su contenido.

Motivo: permite validar el flujo profesional sin convertir la beta en un sistema diagnostico.

## 0014 - Cierre con doble control

Decision: calcular una checklist legible en el dominio y repetir las condiciones minimas en una funcion PostgreSQL usada por RLS.

Motivo: ocultar un boton no es una frontera de seguridad. El backend debe impedir cierres incompletos y cierres realizados por `technical_staff`.

## 0015 - Auditoria de Fase 4 desde el servicio

Decision: conservar temporalmente el patron frontend de fases previas, limitando metadata a estados, conteos e identificadores tecnicos.

Motivo: mantiene coherencia en la beta; la atomicidad mediante RPC o triggers queda registrada como deuda antes de un piloto conectado.

## 0016 - Navegacion local sin nueva dependencia

Decision: implementar el shell y sus destinos con estado React en `ClinicWorkspace`, sin agregar una libreria de routing.

Motivo: los módulos actuales viven en un único flujo autenticado y comparten selección de organización, paciente y screening. Esta solución mejora orientación y demo sin cambiar la arquitectura base; un router podrá evaluarse cuando existan URLs profundas requeridas.

## 0017 - Estados visuales semanticos

Decision: representar estados operativos con texto, punto indicador y tonos no diagnósticos; reservar rojo para errores y acciones destructivas.

Motivo: evita depender únicamente del color, reduce interpretaciones clínicas indebidas y mantiene accesibilidad.

## 0018 - Separacion del bundle por fronteras funcionales

Decision: cargar de forma diferida el workspace autenticado y el módulo que contiene pacientes, screenings y workflow.

Motivo: reduce el JavaScript inicial del login sin alterar servicios ni introducir dependencias. Se conserva Vite como herramienta de build.
