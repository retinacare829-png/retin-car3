# Limitaciones y uso responsable

## Estado de la beta

RetinaCare es una beta académica para validar flujo clínico, gestión, seguridad, trazabilidad y preparación arquitectónica. No es un producto sanitario aprobado ni un sistema listo para atención real.

## Sin capacidad diagnóstica

La beta:

- **no diagnostica** retinopatía diabética ni otra condición;
- no detecta, descarta o gradúa hallazgos;
- no calcula riesgo, probabilidad, score o recomendación automática;
- no produce falsos positivos o falsos negativos algorítmicos porque no existe un modelo activo.

Los estados de calidad, revisión, seguimiento y referencia son registros manuales.

## Inteligencia artificial

La IA no está implementada. El contrato técnico está desacoplado y la implementación beta devuelve `NOT_AVAILABLE`. La interfaz lo comunica de forma visible.

Este desacoplamiento evita simular resultados y permite que una investigación futura se evalúe como componente independiente. No demuestra eficacia clínica ni autoriza una integración automática.

## Responsabilidad profesional

RetinaCare no sustituye al oftalmólogo ni a otro profesional autorizado. El sistema estructura información y decisiones, pero no interpreta las imágenes ni toma decisiones clínicas.

## Imágenes sintéticas

Las imágenes OD/OI de demostración son ilustraciones generadas y marcadas como sintéticas y no diagnósticas. No pertenecen a pacientes, no contienen anatomía clínica evaluable y no deben utilizarse para enseñar hallazgos.

## Validación pendiente

Antes de cualquier uso real se requiere:

- definición formal de uso previsto;
- validación clínica prospectiva;
- métricas predefinidas y revisión de desempeño;
- evaluación de usabilidad con usuarios clínicos;
- gestión de riesgos y factores humanos;
- evaluación de ciberseguridad y privacidad;
- revisión legal y regulatoria aplicable;
- aprobación institucional y consentimiento adecuado.

## Falsos positivos y falsos negativos

La beta no genera predicciones, por lo que no corresponde atribuirle tasas de falsos positivos o negativos. Si se investigara IA en el futuro, deberían medirse sensibilidad, especificidad, valores predictivos, calibración, desempeño por subgrupos, calidad de imagen y consecuencias del error. Siempre sería necesaria supervisión profesional y una política segura para casos no interpretables.

## Operación y alcance técnico

- La demostración depende de Docker y Supabase local.
- No existe modo clínico offline.
- No hay integraciones con expediente electrónico, mensajería, telemedicina o dispositivos.
- No se envían referencias ni recordatorios externos.
- No existe reporte PDF en esta fase.
- La política formal de retención y purga de imágenes aún debe definirse.
- Algunas mutaciones no son completamente atómicas con auditoría y Timeline.

## Uso comercial futuro

Una propuesta comercial solo sería responsable después de validar problema, utilidad, seguridad, cumplimiento y operación. El modelo B2B puede explorarse con clínicas, pero no debe confundirse con autorización sanitaria o evidencia de efectividad clínica.
