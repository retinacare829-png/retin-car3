# Demo Clinica — v0.6 UX + Demo Clinica

## Proposito

Demostrar que RetinaCare permite recorrer de forma clara y trazable un proceso de tamizaje retinal. La beta valida el flujo clínico y la revisión humana; no diagnostica, no clasifica automáticamente y no ofrece IA activa.

## Preparacion

- Usar exclusivamente la clínica y los pacientes ficticios del entorno demo.
- Confirmar que la cuenta tiene una membresía activa y el rol requerido para las acciones que se mostrarán.
- Evitar datos reales, nombres de pacientes reales o imágenes identificables.
- Priorizar laptop o tablet en orientación horizontal.

## Recorrido guiado

1. Iniciar sesión con la cuenta institucional de demostración. Señalar el logo original y el mensaje de alcance beta.
2. Confirmar o seleccionar `Clinica RetinaCare Demo` en el contexto de organización activa.
3. Mostrar el Inicio operativo: identidad de clínica y usuario, navegación y accesos rápidos. Aclarar que no es un dashboard avanzado y no presenta estadísticas inventadas.
4. Seleccionar `Buscar paciente` y localizar un paciente ficticio por nombre, código interno o expediente.
5. Revisar la ficha: identidad básica, estado activo y acciones permitidas por el rol. No interpretar datos como resultado clínico.
6. Abrir un screening existente o crear uno nuevo vinculado al paciente ficticio.
7. Visualizar las imágenes `OD` y `OI`, alternar lateralidad y explicar que las URLs son privadas y temporales.
8. Revisar manualmente la calidad de cada imagen. Si es inadecuada, mostrar los motivos operativos y la sugerencia `Repetir captura`.
9. Mostrar el bloque de IA y leer el mensaje: **Módulo de Inteligencia Artificial no disponible en esta versión beta.** No simular un resultado.
10. Abrir `Workflow Clínico`, completar la revisión profesional estructurada y guardar. Explicar que la decisión corresponde a un profesional autorizado.
11. Crear un seguimiento o una referencia manual ficticia, según el escenario preparado.
12. Revisar el checklist y cerrar el screening únicamente cuando todos los requisitos estén completos. Confirmar la acción en el diálogo de seguridad.
13. Ver el timeline del paciente y señalar la trazabilidad de creación, captura, revisión, seguimiento o referencia y cierre.

## Estados alternos útiles

- Sin pacientes: mostrar la guía para registrar el primero.
- Sin screening: mostrar la acción de creación desde la ficha.
- Sin imagen OD/OI: mostrar el estado vacío de captura.
- Sin seguimiento o referencia: explicar que solo se registran cuando corresponden.
- Pendientes sin datos agregados: mostrar el estado vacío sin inventar conteos.
- Error de red: mostrar un mensaje comprensible y la opción de reintentar, sin detalles técnicos.

## Mensajes obligatorios

> Versión beta. Este sistema no realiza diagnóstico automatizado.

> Prototipo para validación de flujo de trabajo. No destinado a diagnóstico médico.

## Cierre de la demo

RetinaCare demuestra continuidad operativa entre paciente, screening, imágenes, calidad, revisión profesional, seguimiento y timeline. Cualquier conclusión clínica se mantiene bajo responsabilidad del profesional autorizado; la beta no genera diagnóstico ni resultados automáticos.
