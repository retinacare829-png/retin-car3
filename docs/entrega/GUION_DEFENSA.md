# Guion de defensa — RetinaCare

## Mensaje central

RetinaCare es una plataforma HealthTech que organiza de forma segura y trazable el flujo de tamizaje retinal. La beta demuestra gestión multi-clínica, imágenes privadas, revisión humana y continuidad operativa. No diagnostica y no contiene IA activa.

## Presentación de 3 minutos

### 0:00–0:30 — Problema

“El proceso alrededor de una fotografía retinal incluye más que la captura: paciente, lateralidad, calidad, revisión profesional, seguimiento y trazabilidad. Cuando estos elementos están fragmentados, es difícil conocer el estado real de cada caso.”

### 0:30–1:10 — Solución

“RetinaCare centraliza ese recorrido para clínicas. Cada usuario entra con un rol, trabaja dentro de una organización y accede solo a sus datos. El Dashboard muestra carga operativa real.”

### 1:10–2:20 — Demostración

Mostrar Dashboard, abrir Mariana, alternar OD/OI sintéticos, señalar calidad y `NOT_AVAILABLE`, completar revisión/seguimiento y enseñar checklist.

“La decisión continúa siendo humana. El sistema valida que el flujo esté completo antes de cerrar y actualiza Dashboard, Timeline y auditoría.”

### 2:20–3:00 — Cierre

“La contribución de esta beta es una base operativa y segura para validar el proceso. El futuro exige evaluación clínica, regulatoria y de riesgos antes de incorporar IA o usar datos reales.”

## Presentación de 5 minutos

### 0:00–1:00 — Contexto

Explicar fragmentación, falta de estado operativo y necesidad de trazabilidad. Presentar usuarios: técnico, profesional y administrador.

### 1:00–2:00 — Arquitectura

“El frontend usa React y TypeScript. Supabase aporta Auth, PostgreSQL, RLS y Storage privado. `organization_id` y las membresías permiten multi-tenancy. La autorización se vuelve a comprobar en la base de datos.”

### 2:00–4:15 — Flujo

1. Login y clínica activa.
2. Dashboard con datos reales.
3. Paciente demo y screening.
4. Visor OD/OI sintético y calidad manual.
5. IA no disponible.
6. Revisión profesional y seguimiento.
7. Checklist, cierre, Timeline y Dashboard actualizado.

### 4:15–5:00 — Alcance y futuro

“No presentamos un diagnóstico. Presentamos un flujo validable y una frontera segura para investigación futura. El siguiente paso responsable no es activar un modelo: es definir uso previsto, regulación, datos autorizados, métricas y supervisión.”

## Presentación de 10 minutos

### 0:00–1:30 — Problema y oportunidad

- Fragmentación del proceso.
- Necesidad de coordinación entre técnico y profesional.
- Valor de visibilidad operativa para una clínica.

### 1:30–3:00 — Diseño del producto

- Plataforma B2B multi-clínica.
- Roles y permisos.
- Flujo paciente → screening → decisión.
- Dashboard como vista operativa, no diagnóstica.

### 3:00–4:30 — Arquitectura y seguridad

- React/TypeScript por dominio, servicio, hook y componente.
- Supabase Auth y sesión.
- PostgreSQL con integridad multi-tenant.
- RLS como frontera de autorización.
- Storage privado y URLs firmadas.
- Auditoría y Timeline.

### 4:30–8:00 — Demostración completa

Recorrer login, Dashboard, Mariana, OD/OI, calidad, IA no disponible, revisión, seguimiento, checklist, cierre, Timeline y Dashboard. No detenerse en formularios secundarios.

### 8:00–9:00 — Validación

“La QA conectada aplicó migraciones y seed desde cero, probó Auth, roles, dos tenants, Storage privado, URLs firmadas, cierre transaccional, Dashboard reactivo, Timeline y auditoría. Además, pasan pruebas, tipos, lint, build, secret scan y auditoría de dependencias.”

### 9:00–10:00 — Limitaciones y roadmap

Explicar ausencia de IA, diagnóstico, validación clínica y aprobación regulatoria. Cerrar con roadmap de gobernanza, piloto controlado y evaluación separada de IA.

## Qué decir sobre IA

“La IA no está implementada. Existe una interfaz desacoplada que devuelve `NOT_AVAILABLE`, por lo que ningún resultado se simula. Una fase futura necesitaría datos autorizados, protocolo clínico, métricas, control de sesgo, evaluación regulatoria y supervisión profesional.”

## Qué decir sobre seguridad

“El frontend adapta la experiencia por rol, pero la seguridad efectiva está en RLS. Cada fila y objeto se valida contra organización y membresía activa. Las imágenes están en un bucket privado y se abren mediante URLs firmadas temporales.”

## Qué decir sobre falsos positivos y negativos

“La beta no genera predicciones; por tanto, no tiene falsos positivos o negativos algorítmicos. Si se investigara un modelo, mediríamos sensibilidad, especificidad, valores predictivos, calibración, subgrupos y casos no interpretables, con revisión humana obligatoria.”

## Qué decir sobre futuro comercial

“La hipótesis comercial es B2B para clínicas que necesiten estructurar el proceso. Antes de comercializar deben validarse utilidad, cumplimiento, soporte, seguridad, gobernanza de datos y costos. Una oportunidad de mercado no equivale a aprobación clínica.”

## Qué evitar decir

- “La IA detecta retinopatía.”
- “El sistema reemplaza al oftalmólogo.”
- “Está clínicamente validado” o “está aprobado”.
- “Es imposible que haya una filtración.”
- “RLS garantiza toda la seguridad” sin mencionar operación y configuración.
- “Las imágenes son de pacientes.”
- “Ya está listo para producción.”
- Tasas, ahorros o resultados clínicos sin evidencia.

## Respuestas breves para preguntas difíciles

**¿Por qué no implementaron IA?**  
Porque simularla sin datos y validación sería inseguro. Primero se construyó una base trazable y se definió una frontera explícita.

**¿Qué pasa si Supabase falla?**  
La demo tiene checklist y plan B. En operación real se necesitarían alta disponibilidad, backups, monitoreo y recuperación probada.

**¿Cómo protegen datos entre clínicas?**  
Con organización en cada entidad, relaciones consistentes, membresías, roles y RLS; además se validó acceso cruzado en el entorno local.

**¿Cuál es el aporte académico?**  
Diseño e implementación de una plataforma multi-tenant segura y demostrable, con flujo clínico explícito, límites responsables y evidencia de QA conectada.
