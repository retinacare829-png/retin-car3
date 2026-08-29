# Manual de usuario — RetinaCare

## Alcance

Este manual describe la beta de demostración. Utilice únicamente cuentas, pacientes e imágenes ficticias. RetinaCare no emite diagnósticos ni sustituye la evaluación profesional.

## 1. Iniciar sesión

1. Abra la URL local proporcionada por el administrador.
2. Ingrese correo y contraseña de su cuenta.
3. Pulse **Entrar**.
4. Compruebe en el encabezado su correo, rol y organización activa.

Si la sesión no puede iniciarse, verifique la conexión con Supabase y solicite al administrador confirmar que la membresía está activa.

## 2. Seleccionar clínica

Cuando una cuenta pertenece a más de una organización, aparece el selector **Cambiar organización**. Elija la clínica antes de trabajar. Pacientes, screenings, Dashboard y actividad se actualizan según esa selección.

Nunca use una clínica distinta para intentar localizar información que no le corresponde.

## 3. Usar el Dashboard

Abra **Dashboard** desde la navegación. La pantalla presenta:

- resumen del día;
- pacientes y screenings totales;
- pendientes, revisados y seguimientos;
- screenings por mes y distribución por estado;
- actividad reciente;
- agenda del día;
- recorrido sugerido para demostración.

Los indicadores se calculan desde Supabase y reaccionan a las acciones del flujo.

## 4. Crear un paciente

1. Abra **Pacientes**.
2. Complete identificador interno, expediente, nombres, apellidos y fecha de nacimiento.
3. Seleccione sexo y tipo de diabetes cuando se conozcan.
4. Añada teléfono, fecha de diagnóstico y observaciones solo si corresponde y está autorizado.
5. Pulse **Registrar paciente** una vez.

La validación mostrará el primer campo incorrecto. Durante el envío, el botón se deshabilita para evitar duplicados.

## 5. Buscar, editar o archivar

Use el campo **Buscar** por nombre, código o expediente. Puede filtrar por sexo, tipo de diabetes y estado archivado, y ordenar por nombre o fecha.

Las acciones disponibles dependen del rol. Archivar es una eliminación lógica y requiere confirmación; la ficha puede restaurarse.

## 6. Crear un screening

1. Abra los screenings desde la acción de imágenes del paciente.
2. En **Nuevo screening**, seleccione el estado inicial.
3. Añada observaciones generales no diagnósticas si son necesarias.
4. Pulse **Crear**.

El screening queda vinculado al paciente y a la clínica activa.

## 7. Cargar imágenes OD/OI

1. En **Imágenes retinales**, localice **Ojo derecho** y **Ojo izquierdo**.
2. Pulse **Cargar** o **Reemplazar** en la lateralidad correcta.
3. Seleccione únicamente archivos autorizados dentro del límite permitido.
4. Espere la notificación de carga exitosa.

OD y OI deben revisarse por separado. Las imágenes se guardan en Storage privado; no copie ni comparta la URL temporal.

## 8. Usar el visor

Cambie entre los botones **OD** y **OI**. El visor permite aumentar, reducir y restablecer zoom, además de descargar cuando el rol lo permite. Debajo se muestran lateralidad, calidad, tipo MIME y tamaño.

Si una imagen no abre, reintente una vez y comunique el error. En la demo local puede ejecutar `npm run demo:storage` para restaurar los placeholders sintéticos.

## 9. Registrar calidad

1. Seleccione la lateralidad.
2. Elija **Adecuada**, **Inadecuada** o **Pendiente**.
3. Si es inadecuada, marque los motivos aplicables.
4. Pulse **Registrar calidad**.

La calidad describe utilidad técnica de la captura. No constituye diagnóstico ni resultado de IA.

## 10. Revisar el workflow clínico

El bloque **Workflow clínico** resume paciente, screening, OD/OI y calidad. El profesional autorizado registra el estado de revisión, observaciones estructuradas y comentarios.

El mensaje **Módulo de Inteligencia Artificial no disponible en esta versión beta** confirma que la revisión es exclusivamente humana.

## 11. Crear seguimiento

1. Seleccione tipo y estado.
2. Indique fecha sugerida y responsable cuando corresponda.
3. Añada notas autorizadas.
4. Pulse **Registrar seguimiento**.

Un seguimiento puede editarse mientras el screening permanezca abierto y el rol lo permita.

## 12. Crear referencia

1. Escriba motivo y destino.
2. Seleccione fecha solicitada y estado.
3. Añada fecha de finalización solo cuando esté completada.
4. Pulse **Registrar referencia**.

La referencia es un registro manual; RetinaCare no envía solicitudes a terceros.

## 13. Cerrar screening

Antes del cierre, confirme que el checklist marque:

- paciente y screening;
- imagen OD e imagen OI;
- calidad de ambas lateralidades;
- revisión profesional completada;
- seguimiento o decisión registrada.

Pulse **Cerrar screening** y acepte la confirmación. Después del cierre, el workflow queda en modo de consulta para preservar integridad y trazabilidad.

## 14. Consultar Timeline

El **Timeline del paciente** muestra eventos recientes como screening creado, imagen cargada, calidad registrada, revisión, seguimiento, referencia y cierre. Sirve para reconstruir el recorrido operativo sin sustituir la auditoría técnica.

## 15. Cerrar sesión

Pulse **Cerrar sesión** en el encabezado. En un equipo compartido, confirme que volvió a la pantalla de acceso y cierre el navegador.
