# Reportes de Fase 6

La interfaz de Reportes presenta tres vistas profesionales no diagnósticas:

- Por paciente: identificación operativa, último screening y seguimientos activos.
- Por screening: estado, fecha, revisión registrada y cobertura OD/OI.
- Operación: conteos, distribución de estados, revisiones pendientes y continuidad.

Los datos se consultan desde la organización activa y se agregan en `ReportService` a partir de las tablas existentes de pacientes, screenings, revisiones profesionales, seguimientos e imágenes activas. La interfaz no descarga imágenes ni calcula conclusiones clínicas.

## Dependencia pendiente

Para una clínica con volumen alto se debe sustituir la carga completa por una consulta o RPC de reportes server-side, con paginación y agregados protegidos por las políticas existentes. Esta fase deja la dependencia visible en la UI y no modifica migraciones, RLS, Auth, Storage ni IA.

La impresión ocurre únicamente desde la vista previa abierta por la persona usuaria y aplica estilos de impresión que excluyen el resto de la aplicación.
