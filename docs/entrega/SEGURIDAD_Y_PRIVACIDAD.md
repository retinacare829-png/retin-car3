# Seguridad y privacidad — RetinaCare

## 1. Naturaleza de los datos

Una plataforma clínica puede tratar datos identificativos, antecedentes, imágenes y decisiones profesionales. Aunque la demostración usa exclusivamente información ficticia, el diseño considera estos elementos sensibles y aplica mínimo privilegio, separación organizacional y trazabilidad.

La beta no debe utilizarse con datos reales sin evaluación legal, regulatoria, clínica y de seguridad adicional.

## 2. Autenticación

Supabase Auth gestiona credenciales y sesión. El frontend no almacena contraseñas ni incorpora claves privadas. La anon key de Supabase identifica al cliente público, pero no concede por sí sola acceso: cada consulta queda sujeta a sesión y RLS.

Las credenciales demo usan dominios `.test`, son locales y deben reemplazarse en cualquier entorno distinto de la demostración.

## 3. Autorización

La autorización se aplica en dos niveles:

1. La interfaz adapta acciones según el rol para reducir errores.
2. PostgreSQL aplica RLS aunque alguien intente omitir la interfaz.

No se considera suficiente ocultar un botón. La base de datos decide si una fila puede leerse o modificarse.

## 4. Roles

- **Administrador de clínica:** operaciones administrativas y clínicas habilitadas para su organización.
- **Personal técnico:** pacientes, screenings, imágenes y calidad; no puede completar decisiones profesionales reservadas.
- **Profesional autorizado:** revisión, seguimiento, referencia y cierre, con lectura clínica necesaria.

Las membresías suspendidas y usuarios sin organización no obtienen acceso.

## 5. Aislamiento por clínica

RetinaCare es multi-tenant. Las tablas clínicas incorporan `organization_id` y relaciones que impiden combinar un paciente de una clínica con un screening o imagen de otra.

El contexto activo filtra la experiencia, mientras RLS valida que el usuario sea miembro activo de la organización de cada fila.

## 6. Row Level Security

Las políticas RLS cubren organizaciones, membresías, pacientes, screenings, imágenes, calidad, workflow, Timeline y auditoría. Las decisiones consideran rol, membresía y tenant.

La QA conectada verificó aislamiento entre dos clínicas, rechazo de membresía suspendida y bloqueo de acciones no autorizadas. Estas pruebas deben repetirse en CI o en el entorno de despliegue antes de un piloto.

## 7. Storage privado

El bucket `retinal-images-private` permanece privado. Las rutas incluyen:

```text
organización/paciente/screening/lateralidad/archivo
```

Las políticas de Storage comprueban el tenant y el rol. No se ofrecen URLs públicas permanentes.

## 8. URLs firmadas

El visor solicita URLs firmadas temporales. Una URL expirada deja de ser válida y otro tenant no puede firmar el objeto. Estas URLs no deben registrarse en documentación, capturas, mensajes o auditoría.

La caducidad reduce exposición, pero no elimina la responsabilidad de controlar dispositivos, descargas y sesiones.

## 9. Auditoría y Timeline

`audit_logs` registra usuario, acción, entidad, fecha y campos modificados. Sus metadatos evitan copiar texto clínico libre cuando basta con estados o identificadores técnicos.

`patient_timeline_events` ofrece continuidad comprensible al usuario. Timeline y auditoría son complementarios: uno explica el recorrido y la otra apoya control técnico.

El cierre es transaccional y genera registro de auditoría y Timeline junto con el cambio de estado.

## 10. Datos demo

- Nombres, expedientes, teléfonos, organizaciones y usuarios del seed son ficticios.
- Los correos usan `example.test`.
- OD/OI son ilustraciones generadas con la marca “DEMO SINTÉTICA — NO DIAGNÓSTICA”.
- No se utilizan fotografías reales ni imágenes médicas licenciadas de terceros.
- `npm run demo:storage` rechaza hosts no locales.

## 11. Secretos y configuración

`.env` no se versiona. `.env.example` documenta solo nombres de variables. Service-role keys y credenciales privadas no pertenecen al frontend ni al repositorio.

El comando `npm run secret:scan` busca patrones de secretos antes de entregar cambios. También se ejecuta `npm audit` para revisar dependencias conocidas.

## 12. Riesgos y controles futuros

Antes de tratar datos reales se requieren, como mínimo:

- análisis de impacto de privacidad;
- política de consentimiento, minimización, retención y borrado;
- MFA y endurecimiento de cuentas según riesgo;
- cifrado y gestión de secretos del entorno hospedado;
- monitoreo, alertas y respuesta a incidentes;
- backups probados y recuperación;
- pruebas de penetración y revisión independiente de RLS;
- acuerdos con proveedores y evaluación regulatoria.
