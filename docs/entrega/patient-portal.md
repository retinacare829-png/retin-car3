# Contrato de datos: portal de paciente

## Vinculación y autorización

- La cuenta se vincula explícitamente por `auth.users.id` mediante `public.patient_accounts`.
- El vínculo contiene `organization_id`, `patient_id`, `user_id` y `status`.
- No se usa email para autorización y no existe auto-vinculación.
- Solo `clinic_admin` puede ejecutar `link_patient_account(organization_id, patient_id, user_id)` o `revoke_patient_account(organization_id, patient_id)`.
- Una cuenta de paciente no se agrega a `organization_members`; por ello no hereda la lectura de toda la clínica.

## Publicación clínica

- Un screening solo aparece en el portal cuando `patient_published_at` no es nulo.
- La publicación es independiente de `status = 'CERRADO'`.
- Solo `clinic_admin` o `authorized_professional` puede ejecutar `publish_screening_to_patient(screening_id)`.
- La publicación debe partir de `REVISADO` o `SEGUIMIENTO_REQUERIDO`; un screening `CERRADO` solo permanece visible si fue publicado antes de cerrarse. Los estados preliminares nunca se exponen.

## RPC de lectura

`get_patient_portal_snapshot()` no recibe `patient_id`, `organization_id` ni email. Resuelve la cuenta desde `auth.uid()` y devuelve un objeto JSON con `profile`, `screenings` y `reports`:

```ts
{
  contractVersion: 1;
  profile: {
    id: string;
    internalIdentifier: string;
    firstNames: string;
    lastNames: string;
    dateOfBirth: string;
    sex: "female" | "male" | "other" | "unknown";
    phone: string | null;
  };
  screenings: Array<{
    id: string;
    recordCode: string;
    status: "REVISADO" | "SEGUIMIENTO_REQUERIDO" | "CERRADO";
    publishedAt: string;
    createdAt: string;
    closedAt: string | null;
  }>;
  reports: Array<{
    screeningId: string;
    recordCode: string;
    status: "REVISADO" | "SEGUIMIENTO_REQUERIDO" | "CERRADO";
    publishedAt: string;
    generalObservations: string | null;
    professionalReview: {
      status: string;
      reviewedAt: string | null;
      structuredObservations: Record<string, boolean>;
      notes: string | null;
    } | null;
    followUps: Array<{
      id: string;
      type: string;
      status: string;
      dueDate: string | null;
      completedAt: string | null;
      notes: string | null;
    }>;
    referrals: Array<{
      id: string;
      reason: string;
      destination: string;
      status: string;
      requestedDate: string;
      completedDate: string | null;
      notes: string | null;
    }>;
    images: Array<{
      id: string;
      laterality: "OD" | "OI";
      capturedAt: string;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
    }>;
  }>;
}
```

El RPC es la única superficie de lectura del portal. El paciente no tiene `SELECT` directo sobre las tablas clínicas; los reportes incluyen metadatos de imagen, pero no rutas de Storage ni bytes. Las tablas y objetos internos de imágenes y reportes clínicos no se exponen directamente al paciente.

Sin vínculo activo, `get_patient_portal_snapshot()` falla con SQLSTATE `42501` y no devuelve `null`. La publicación recibe únicamente `screening_id`; el `organization_id`, paciente y actor se resuelven desde el registro y `auth.uid()`.
