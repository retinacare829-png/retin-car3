# Portal de paciente — contrato de la fase 13

## Identidad y permisos

La cuenta de Auth se vincula a un paciente y una clínica mediante `public.patient_accounts`. No se infiere el vínculo del correo ni se agrega al paciente a `organization_members`, que representa al personal de la clínica. Solo un administrador clínico puede vincular o revocar la cuenta. Una cuenta revocada o suspendida no recibe datos del portal.

El navegador llama a `public.get_patient_portal_snapshot()` sin parámetros. La función resuelve al paciente con `auth.uid()` y devuelve un JSON versionado con `profile`, `screenings` y `reports`. No acepta `patient_id`, `organization_id` ni rol enviados por el cliente. Sin vínculo activo, responde con SQLSTATE `42501`.

## Publicación

`publish_screening_to_patient(screening_id)` es una acción auditada, independiente del cierre del screening. Solo un administrador o profesional autorizado puede ejecutarla desde un screening `REVISADO` o `SEGUIMIENTO_REQUERIDO`, y únicamente cuando existe una revisión profesional completada. Cerrar un screening no lo publica. Un screening cerrado solo sigue visible si fue publicado previamente.

El snapshot muestra únicamente screenings publicados y un resumen de cada informe publicado. Al aprobar, el texto de `general_observations` se copia a `patient_report_summary` y queda congelado; cambios clínicos posteriores no alteran lo que ve el paciente. El profesional debe revisar ese texto antes de publicar. Si está vacío, el portal presenta un aviso genérico de consultar a la clínica. No se entregan notas internas de revisiones, seguimientos o referencias, imágenes, rutas de Storage ni bytes. Mostrar imágenes al paciente requiere una fase posterior con autorización específica.

## Forma de respuesta

```ts
{
  contractVersion: 1;
  profile: {
    patientId: string;
    organizationId: string;
    organizationName: string;
    displayName: string;
    firstNames: string;
    lastNames: string;
    dateOfBirth: string;
    phone: string | null;
    email: string | null;
  };
  screenings: Array<{
    id: string;
    recordCode: string;
    createdAt: string;
    status: string;
    statusLabel: string;
    reportPublished: true;
  }>;
  reports: Array<{
    id: string;
    screeningId: string;
    recordCode: string;
    title: string;
    summary: string;
    nextStep: null;
    publishedAt: string;
    publishedBy: string | null;
  }>;
}
```

El paciente no tiene `SELECT` directo sobre pacientes, screenings, revisiones ni Storage. Las vistas del frontend no son una barrera de seguridad: el aislamiento se verifica en la base de datos.

El workflow clínico incluye la acción explícita de compartir el informe, con vista previa del resumen y confirmación. La vinculación inicial de una cuenta de paciente todavía requiere soporte autorizado; usar solo datos ficticios en la demo y no presentar el portal como autoservicio clínico completo.
