# Informe técnico — RetinaCare

## 1. Identificación del proyecto

**Nombre:** RetinaCare  
**Categoría:** plataforma HealthTech B2B para gestión de flujo de tamizaje retinal  
**Estado:** beta académica demostrable en entorno local

## 2. Objetivo

RetinaCare estructura y hace trazable el proceso operativo asociado a fotografías de fondo de ojo: identificación del paciente, creación del screening, carga OD/OI, evaluación manual de calidad, revisión profesional, seguimiento o referencia y cierre controlado.

La beta valida gestión, seguridad, aislamiento organizacional y experiencia de trabajo. No realiza diagnóstico ni análisis automatizado.

## 3. Problema abordado

Los procesos clínicos que combinan pacientes, imágenes y decisiones de seguimiento pueden fragmentarse entre archivos, sistemas generales y comunicación informal. Esto dificulta conocer el estado de cada estudio, asignar responsabilidades y reconstruir qué ocurrió.

RetinaCare centraliza el recorrido en un modelo consistente y multi-tenant. Cada acción queda vinculada a una clínica, un paciente y, cuando corresponde, un screening.

## 4. Tecnologías utilizadas

| Capa | Tecnología | Propósito |
| --- | --- | --- |
| Frontend | React 18 | Interfaz basada en componentes |
| Lenguaje | TypeScript estricto | Tipado y contratos verificables |
| Build | Vite | Desarrollo y compilación |
| Validación | Zod | Validación de formularios y dominio |
| Backend | Supabase | API, Auth, PostgreSQL y Storage |
| Base de datos | PostgreSQL | Persistencia relacional y funciones transaccionales |
| Autorización | Row Level Security | Aislamiento por usuario, rol y organización |
| Pruebas | Vitest, Testing Library, SQL QA | Dominio, servicios, UI y seguridad conectada |
| UI | CSS propio, Lucide React | Sistema visual y accesibilidad |

## 5. Arquitectura general

La solución separa presentación, estado de aplicación, dominio y persistencia:

```text
Componentes React
      ↓
Hooks de módulo
      ↓
Servicios tipados
      ↓
Cliente Supabase
      ↓
PostgreSQL + Auth + RLS + Storage privado
```

El frontend no accede a tablas mediante credenciales privilegiadas. Usa la sesión del usuario y la anon key pública prevista por Supabase; las políticas RLS constituyen la frontera efectiva de autorización.

## 6. Patrón de frontend

Cada módulo sigue una organización coherente:

- `domain/`: tipos, esquemas y reglas puras, como filtros y checklist de cierre.
- `services/`: consultas y mutaciones contra Supabase.
- `hooks/`: carga, errores, permisos, mutaciones e invalidación selectiva.
- `components/`: formularios, tablas, visor, Dashboard y workflow.

La invalidación por áreas actualiza solo las vistas afectadas. Las pantallas pesadas se cargan de forma diferida y los estados de carga, error, vacío y notificación se reutilizan.

## 7. Supabase y PostgreSQL

PostgreSQL contiene las entidades `organizations`, `profiles`, `organization_members`, `patients`, `screenings`, `retinal_images`, `image_quality_reviews`, `professional_reviews`, `follow_ups`, `referrals`, `patient_timeline_events` y `audit_logs`.

Se utilizan claves foráneas compuestas para conservar coherencia entre organización, paciente y screening. El cierre se ejecuta con la función transaccional `close_screening_workflow`, que valida requisitos y registra trazabilidad.

## 8. Autenticación

Supabase Auth administra inicio, persistencia y cierre de sesión. El contexto de organización se obtiene a partir de membresías activas. Una membresía suspendida o ausente no concede acceso clínico.

Las credenciales incluidas en el seed son exclusivamente ficticias y locales; no representan cuentas de producción.

## 9. RLS y modelo multi-tenant

Todas las entidades clínicas incluyen `organization_id`. Las políticas RLS comprueban:

- usuario autenticado;
- membresía activa;
- organización correspondiente;
- rol habilitado para la operación.

La validación conectada comprobó que una clínica no puede consultar pacientes, screenings ni objetos privados de otra. El filtrado del frontend mejora la consulta, pero no sustituye a RLS.

## 10. Roles

| Rol | Responsabilidad principal |
| --- | --- |
| Administrador de clínica | Gestión operativa completa, revisión, cierre y consulta de auditoría |
| Personal técnico | Pacientes, screenings, carga OD/OI y calidad manual |
| Profesional autorizado | Lectura clínica, calidad, revisión, seguimiento, referencia y cierre |

La interfaz oculta o deshabilita acciones no autorizadas y la base de datos vuelve a validar el permiso.

## 11. Storage privado

Las imágenes se almacenan en `retinal-images-private` siguiendo rutas por organización, paciente, screening y lateralidad. El bucket no es público. La visualización utiliza URLs firmadas de corta duración.

Para la defensa se usan dos ilustraciones generadas, marcadas como sintéticas y no diagnósticas. El comando `npm run demo:storage` solo acepta Supabase local, carga los objetos de forma idempotente y valida sus URLs firmadas.

## 12. Flujo clínico implementado

1. Autenticación y selección de clínica.
2. Registro o búsqueda de paciente.
3. Creación de screening.
4. Carga y visualización OD/OI.
5. Registro manual de calidad.
6. Revisión por profesional autorizado.
7. Seguimiento o referencia.
8. Checklist de requisitos.
9. Cierre transaccional.
10. Actualización de Dashboard, Timeline y auditoría.

El módulo de IA muestra `NOT_AVAILABLE`; no produce resultados ni influye en el workflow.

## 13. Dashboard

El Dashboard consulta información real de la organización activa: pacientes, screenings, pendientes, revisados, seguimientos, resumen diario, tendencia mensual, distribución por estado, agenda y actividad reciente. Después de una mutación, las consultas relacionadas se invalidan sin recargar la aplicación completa.

## 14. Validación conectada

La validación local incluyó:

- aplicación de migraciones y seed desde cero;
- Auth con perfiles de administrador, técnico y profesional;
- aislamiento de dos organizaciones;
- RLS, Storage privado y URLs firmadas;
- creación y consulta de pacientes y screenings;
- calidad, revisión, seguimiento, cierre, Timeline y auditoría;
- recorrido visual completo del caso demo;
- pruebas automatizadas, typecheck, lint, build, escaneo de secretos y auditoría de dependencias.

La evidencia operativa se conserva en `docs/QA_SUPABASE.md` y `docs/DEFENSA_DEMO.md`.

## 15. Limitaciones

- No existe algoritmo de IA activo.
- No diagnostica ni descarta retinopatía.
- No sustituye al oftalmólogo.
- No está validado clínicamente ni aprobado por una autoridad sanitaria.
- No incorpora MFA, integraciones externas, recordatorios o estrategia offline clínica.
- Algunas mutaciones y sus eventos de trazabilidad son llamadas separadas; antes de un piloto real requieren mayor atomicidad.
- La política de retención y eliminación física de imágenes requiere definición formal.

## 16. Roadmap futuro

El roadmap es orientativo y no forma parte de la beta entregada:

1. Investigación regulatoria y clasificación del producto.
2. Gestión formal de riesgos y requisitos clínicos.
3. Pruebas de seguridad y observabilidad en entorno hospedado controlado.
4. Piloto con gobernanza de datos, consentimiento y retención definidos.
5. Evaluación separada de IA con dataset autorizado, métricas clínicas, control de sesgo y supervisión profesional.
6. Interoperabilidad y operación comercial solo después de validar seguridad, utilidad y cumplimiento.
