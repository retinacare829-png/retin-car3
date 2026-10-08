# Contrato mínimo del portal paciente

Este contrato permite que el frontend muestre un portal separado del espacio clínico sin aceptar identificadores de paciente desde el navegador.

## Backend boundary

El frontend llama a la RPC curada `public.get_patient_portal_snapshot()` sin parámetros. La RPC debe derivar el paciente desde la sesión autenticada y la relación `patient_accounts`.

La llamada no recibe parámetros de paciente:

```json
{}
```

El backend debe derivar el usuario desde el JWT/sesión y resolver la relación autorizada `auth.uid() -> patient_id`. No debe confiar en `patientId`, `organizationId` ni roles enviados por el cliente.

## Respuesta

```json
{
  "contractVersion": 1,
  "profile": {
    "patientId": "uuid",
    "organizationId": "uuid",
    "organizationName": "Clínica RetinaCare",
    "displayName": "María",
    "firstNames": "María",
    "lastNames": "Ejemplo",
    "dateOfBirth": "1980-04-03",
    "phone": "88888888",
    "email": "maria@example.test"
  },
  "screenings": [
    {
      "id": "uuid",
      "recordCode": "RC-0001",
      "createdAt": "2026-10-08T12:00:00Z",
      "status": "REVISADO",
      "statusLabel": "Revisado",
      "reportPublished": true
    }
  ],
  "reports": [
    {
      "id": "uuid",
      "screeningId": "uuid",
      "recordCode": "RC-0001",
      "title": "Informe de screening",
      "summary": "Texto aprobado para compartir con el paciente.",
      "nextStep": "Control según indicación de la clínica",
      "publishedAt": "2026-10-08T13:00:00Z",
      "publishedBy": "Profesional autorizado"
    }
  ]
}
```

## Reglas de seguridad y publicación

- La respuesta debe pertenecer exclusivamente al paciente autenticado.
- El estado de un screening puede ser básico y operativo; no debe incluir observaciones internas, imágenes privadas, notas del profesional ni borradores.
- `reports` debe contener únicamente informes con aprobación explícita y publicación efectiva. Los informes pendientes, borradores y resultados no aprobados deben excluirse del payload, no enviarse con una bandera para que el frontend los oculte.
- La autorización debe aplicarse en la RPC/RLS y el backend debe devolver una respuesta de acceso denegado cuando corresponda. El frontend no debe usar `user_metadata` ni modificar JWT metadata para vincular pacientes.
- No exponer `service_role` ni credenciales privilegiadas al navegador.
