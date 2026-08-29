# Guía de defensa — RetinaCare Fase 5.6

## Objetivo y alcance

Presentar un flujo clínico trazable de tamizaje retinal con datos enteramente ficticios. RetinaCare actualmente **no diagnostica**, **no sustituye al oftalmólogo** y no ejecuta IA. La IA está desacoplada y corresponde a una fase futura. Esta beta valida gestión, flujo clínico, seguridad, aislamiento por organización, trazabilidad y preparación arquitectónica para una integración futura.

## Credenciales locales de demostración

Estas cuentas existen únicamente después de aplicar el seed local. El dominio `.test` no recibe correo y la contraseña es ficticia; nunca debe reutilizarse en un entorno hospedado.

| Escenario | Usuario | Contraseña | Uso recomendado |
| --- | --- | --- | --- |
| Recorrido completo | `admin.demo@example.test` | `RetinaCare-Demo-2026!` | Crear, revisar y cerrar en una sola sesión |
| Revisión profesional | `profesional.demo@example.test` | `RetinaCare-Demo-2026!` | Explicar separación de responsabilidades |
| Captura técnica | `tecnico.demo@example.test` | `RetinaCare-Demo-2026!` | Mostrar creación, imágenes y calidad |
| Segunda clínica | `admin.clinica-b@example.test` | `RetinaCare-Demo-2026!` | Demostrar aislamiento organizacional |

Pacientes y organizaciones son ficticios. No introducir nombres, expedientes ni imágenes de personas reales.

## Orden recomendado de pantallas

1. Login.
2. Dashboard.
3. Modo Demo / Recorrido sugerido.
4. Pacientes.
5. Screenings e imágenes.
6. Workflow clínico.
7. Timeline del paciente.
8. Dashboard actualizado.
9. Supabase Studio, solo si preguntan por auditoría o aislamiento.

## Guion exacto de la demostración

### 1. Iniciar sesión

Acción: entrar con `admin.demo@example.test`.

Qué decir: “La sesión y los permisos se resuelven con Supabase Auth. Cada consulta queda limitada a la organización activa y al rol del usuario.”

### 2. Mostrar el Dashboard dinámico

Acción: abrir **Dashboard** y señalar resumen del día, KPIs, gráficas, actividad y agenda.

Qué decir: “Estas cifras no están simuladas: pacientes, screenings, revisiones, seguimientos y Timeline se consultan desde Supabase. Al cambiar el flujo, se invalidan únicamente los datos afectados.”

### 3. Abrir el recorrido sugerido

Acción: usar **Abrir pacientes demo** en la tarjeta **Modo Demo**.

Qué decir: “Esta tarjeta guía al presentador; no crea datos ni cambia información clínica.”

### 4. Buscar al paciente preparado

Acción: buscar `Mariana` o `DEMO-OFT-001` y abrir sus screenings.

Qué decir: “Los datos son ficticios. La búsqueda y los filtros trabajan sobre registros de la clínica activa.”

### 5. Abrir el screening preparado

Acción: seleccionar el screening del 18 de agosto en estado **Pendiente de revisión**.

Qué decir: “Un screening pertenece simultáneamente a una organización y a un paciente; el flujo conserva estados y trazabilidad.”

### 6. Mostrar imágenes OD/OI y calidad

Acción: alternar OD y OI. Si el Storage local contiene los archivos demo, abrir ambas imágenes; registrar OI como **Adecuada** para dejar el caso listo para cierre.

Qué decir: “Las imágenes se manejan en un bucket privado y se visualizan mediante URLs temporales. La calidad es una evaluación manual, no una inferencia diagnóstica.”

### 7. Mostrar el límite de IA

Acción: señalar el bloque `NOT_AVAILABLE`.

Qué decir: “La IA está deliberadamente desacoplada y no forma parte de esta beta. RetinaCare actualmente no diagnostica ni clasifica imágenes.”

### 8. Completar revisión profesional

Acción: seleccionar **Revisión completada**, marcar **Revisión completada** en observaciones y guardar.

Qué decir: “La conclusión del flujo la registra un profesional autorizado. El sistema estructura el proceso, pero no reemplaza su criterio.”

### 9. Registrar decisión

Acción: crear un seguimiento tipo **Control programado**, estado **Control programado**, con fecha de hoy; alternativamente crear una referencia ficticia.

Qué decir: “Seguimientos y referencias son decisiones manuales y quedan vinculados al screening.”

### 10. Cerrar el screening

Acción: confirmar que el checklist está completo, pulsar **Cerrar screening** y aceptar la confirmación.

Qué decir: “El cierre exige paciente, screening, OD/OI, calidad, revisión y una decisión registrada. Se ejecuta de forma controlada y conserva auditoría.”

### 11. Mostrar Timeline y auditoría

Acción: revisar el Timeline visible. Si se solicita evidencia técnica, abrir Supabase Studio → Table Editor y consultar `audit_logs` sin mostrar tokens ni texto clínico sensible.

Qué decir: “El Timeline explica el caso al usuario; la auditoría registra eventos sensibles para trazabilidad. Son propósitos complementarios.”

### 12. Volver al Dashboard

Acción: abrir **Dashboard** y señalar pendientes, revisados, agenda y actividad actualizados.

Qué decir: “La interfaz refleja el cambio sin recargar toda la aplicación.”

## Qué evitar decir

- No afirmar que RetinaCare detecta, predice, diagnostica o descarta retinopatía.
- No llamar “resultado de IA” a una revisión o estado manual.
- No afirmar que la beta está validada clínicamente, certificada o lista para uso asistencial real.
- No mostrar claves JWT, service-role keys, `.env`, tokens, URLs firmadas completas o datos reales.
- No improvisar una carga con una imagen identificable.
- No modificar RLS o seeds durante la defensa.

## Preguntas frecuentes

**¿RetinaCare diagnostica retinopatía diabética?**  
No. La beta organiza captura, revisión profesional, seguimiento y trazabilidad. No produce diagnóstico.

**¿Sustituye al oftalmólogo?**  
No. Toda revisión y decisión clínica corresponde a profesionales autorizados.

**¿Dónde está la IA?**  
Está fuera de esta fase y desacoplada detrás de una frontera explícita `NOT_AVAILABLE`. Una integración futura requeriría validación clínica, regulatoria y técnica.

**¿Los números del Dashboard son reales?**  
Son cálculos sobre los registros ficticios persistidos en Supabase; no son contadores escritos a mano.

**¿Cómo se separan las clínicas?**  
Mediante `organization_id`, membresías, roles y RLS. La segunda clínica del seed permite demostrar el aislamiento.

**¿Las imágenes son públicas?**  
No. Storage es privado y el acceso usa URLs firmadas de duración limitada.

**¿Qué se audita?**  
Operaciones sensibles de pacientes, screenings, imágenes y workflow, sin usar la auditoría como sustituto del Timeline visible.

## Planes de contingencia

### Si Supabase local falla

1. No ejecutar un reset repetidamente frente al jurado.
2. Confirmar `docker ps` y `npx supabase status` desde una terminal ya preparada.
3. Intentar una sola recuperación con `npx supabase stop` y `npx supabase start`.
4. Si no recupera, mostrar la interfaz hasta el estado disponible y continuar con esta guía, los tests aprobados y `docs/QA_SUPABASE.md` como evidencia del último QA conectado.
5. Explicar con transparencia que el bloqueo es del entorno local, no simular operaciones exitosas.

### Si internet falla

El recorrido local no necesita internet después de instalar dependencias: usar Supabase local, Vite local y assets del repositorio. Evitar recargar documentación externa y continuar en `http://127.0.0.1:5173`.

### Si una imagen no carga

1. Cambiar de OD a OI y reintentar una vez.
2. Ejecutar `npm run demo:storage` y recargar el screening.
3. Mostrar metadatos, lateralidad, calidad y el estado vacío/error amigable.
4. Explicar el bucket privado y la URL firmada sin exponerla.
5. Nunca usar una imagen real como reemplazo improvisado.

## Regenerar y cargar imágenes demo

Los archivos `assets/demo/demo-od-synthetic.jpg` y `assets/demo/demo-oi-synthetic.jpg` son ilustraciones generadas, claramente marcadas como **DEMO SINTÉTICA — NO DIAGNÓSTICA**. No proceden de pacientes, no representan hallazgos y no deben interpretarse clínicamente.

Después de `npm run supabase:reset`, cargarlos en el bucket privado con:

```powershell
npm run demo:storage
```

El script:

- rechaza cualquier URL que no sea `localhost`, `127.0.0.1` o `::1`;
- obtiene URL y anon key desde `.env`, sin claves incluidas en código;
- inicia sesión con la cuenta demo local;
- usa las rutas de organización/paciente/screening del seed;
- reutiliza el objeto cuando ya existe y solo inserta cuando falta, por lo que puede repetirse sin requerir permisos de actualización;
- crea una URL firmada temporal por imagen y verifica una respuesta JPEG correcta;
- mantiene privado `retinal-images-private`.

Resultado esperado:

```text
OK OD: archivo sintético privado y URL firmada válida.
OK OI: archivo sintético privado y URL firmada válida.
Storage demo local preparado de forma idempotente.
```

## QA final de Fase 5.6.1

Fecha: 2026-08-29.

- Base local restaurada desde migraciones y seed sin errores.
- OD/OI sintéticos cargados físicamente en Storage privado y validados mediante URLs firmadas.
- Cargador ejecutado dos veces consecutivas con éxito para comprobar idempotencia bajo RLS.
- Visor verificado en ambas lateralidades, sin estado de error y con leyendas sintéticas visibles.
- Login, Dashboard, paciente Mariana, screening preparado, calidad OI, `NOT_AVAILABLE`, revisión profesional y seguimiento completados en la UI.
- Checklist completo, diálogo aceptado y screening cerrado correctamente.
- Dashboard confirmado después del cierre: pendientes `4 → 3`, revisados `2 → 3`, revisiones pendientes `1 → 0` y “Screening cerrado” como actividad más reciente.
- Timeline confirmado con Calidad registrada, Revisión completada, Seguimiento creado y Screening cerrado.
- `audit_logs` confirmado con `image_quality_review.recorded`, `professional_review.updated`, `follow_up.created` y `screening.closed`.
- Bucket permaneció privado; no se modificaron RLS, migraciones ni arquitectura.
- Al finalizar el QA se reaplicaron seed y carga de Storage para dejar el caso preparado, abierto y listo para la defensa.
