import { FormEvent, useEffect, useState } from "react";
import {
  diabetesTypeLabels,
  diabetesTypeValues,
  patientCreateSchema,
  patientSexLabels,
  patientSexValues,
  patientUpdateSchema,
  type Patient,
  type PatientCreateData,
  type PatientFormInput,
} from "../domain/patient";

interface PatientFormProps {
  patient: Patient | null;
  disabled: boolean;
  onCancel: () => void;
  onFocusExistingPatient?: () => void;
  onSubmit: (data: PatientFormSubmission) => Promise<void>;
}

export type PatientFormSubmission = PatientCreateData;

type PatientFormState = Omit<PatientFormInput, "medicalRecordCode">;

const emptyForm: PatientFormState = {
  internalIdentifier: "",
  firstNames: "",
  lastNames: "",
  dateOfBirth: "",
  sex: "unknown",
  phone: "",
  diabetesDiagnosisDate: "",
  diabetesType: "unknown",
  notes: "",
};

function patientSaveError(caught: unknown) {
  const candidate = caught as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const message = typeof candidate?.message === "string" ? candidate.message : "";

  if (code === "23505" || /duplicate|unique|already exists/i.test(message)) {
    return "No se pudo guardar la ficha porque el identificador del paciente ya existe. Busque la ficha existente y edítela; no se fusionan fichas automáticamente.";
  }

  return "No se pudo guardar el paciente. Revise los datos e intente nuevamente.";
}

export function PatientForm({ patient, disabled, onCancel, onFocusExistingPatient, onSubmit }: PatientFormProps) {
  const [form, setForm] = useState<PatientFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patient) {
      setForm(emptyForm);
      setError(null);
      return;
    }

    setForm({
      internalIdentifier: patient.internalIdentifier,
      firstNames: patient.firstNames,
      lastNames: patient.lastNames,
      dateOfBirth: patient.dateOfBirth,
      sex: patient.sex,
      phone: patient.phone ?? "",
      diabetesDiagnosisDate: patient.diabetesDiagnosisDate ?? "",
      diabetesType: patient.diabetesType,
      notes: patient.notes ?? "",
    });
    setError(null);
  }, [patient]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setError(null);

    const { internalIdentifier, ...editableFields } = form;
    void internalIdentifier;
    const parsed = patient ? patientUpdateSchema.safeParse(editableFields) : patientCreateSchema.safeParse(editableFields);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise los datos del paciente.");
      return;
    }

    const submission: PatientFormSubmission = parsed.data;

    try {
      await onSubmit(submission);
      setError(null);
      if (!patient) setForm(emptyForm);
    } catch (caught) {
      setError(patientSaveError(caught));
    }
  }

  return (
    <form className="patient-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="form-heading">
        <h2>{patient ? "Editar paciente" : "Registrar paciente"}</h2>
        <p>Use solamente datos ficticios durante la beta de demostración.</p>
      </div>

      {!patient ? (
        <aside className="patient-form-guidance" role="note">
          <strong>¿La ficha ya existe?</strong>
          <p>Busque primero por nombre o identificador interno para evitar duplicar la ficha del paciente.</p>
          {onFocusExistingPatient ? <button className="text-button" onClick={onFocusExistingPatient} type="button">Buscar ficha existente</button> : null}
          <span>El identificador interno se asigna al guardar; el expediente se genera para cada visita.</span>
        </aside>
      ) : (
        <div className="patient-generated-fields" aria-label="Identificador de ficha">
          <label>
            Identificador interno
            <input aria-readonly="true" disabled={disabled} readOnly value={form.internalIdentifier} />
          </label>
          <p>El identificador interno es fijo por paciente. El expediente se genera y se muestra en cada screening.</p>
        </div>
      )}

      <div className="form-grid">
        <label>
          Nombres
          <input
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, firstNames: event.target.value }))}
            required
            value={form.firstNames}
          />
        </label>

        <label>
          Apellidos
          <input
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, lastNames: event.target.value }))}
            required
            value={form.lastNames}
          />
        </label>

        <label>
          Fecha de nacimiento
          <input
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
            required
            type="date"
            value={form.dateOfBirth}
          />
        </label>

        <label>
          Sexo
          <select
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, sex: event.target.value as PatientFormInput["sex"] }))}
            value={form.sex}
          >
            {patientSexValues.map((value) => (
              <option key={value} value={value}>
                {patientSexLabels[value]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Telefono opcional
          <input
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            value={form.phone ?? ""}
          />
        </label>

        <label>
          Fecha diagnostico diabetes
          <input
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, diabetesDiagnosisDate: event.target.value }))}
            type="date"
            value={form.diabetesDiagnosisDate ?? ""}
          />
        </label>

        <label>
          Tipo de diabetes
          <select
            disabled={disabled}
            onChange={(event) =>
              setForm((current) => ({ ...current, diabetesType: event.target.value as PatientFormInput["diabetesType"] }))
            }
            value={form.diabetesType}
          >
            {diabetesTypeValues.map((value) => (
              <option key={value} value={value}>
                {diabetesTypeLabels[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="form-grid-wide">
          Observaciones
          <textarea
            disabled={disabled}
            maxLength={1000}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            rows={4}
            value={form.notes ?? ""}
          />
        </label>
      </div>

      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <div className="form-actions">
        <button className="primary-button" disabled={disabled} type="submit">
          {patient ? "Guardar cambios" : "Registrar paciente"}
        </button>
        <button className="ghost-button" disabled={disabled} onClick={onCancel} type="button">
          Cancelar
        </button>
      </div>
    </form>
  );
}
