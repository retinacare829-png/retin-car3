import { FormEvent, useEffect, useState } from "react";
import {
  diabetesTypeLabels,
  diabetesTypeValues,
  patientFormSchema,
  patientSexLabels,
  patientSexValues,
  type Patient,
  type PatientFormData,
  type PatientFormInput,
} from "../domain/patient";

interface PatientFormProps {
  patient: Patient | null;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (data: PatientFormData) => Promise<void>;
}

const emptyForm: PatientFormInput = {
  internalIdentifier: "",
  medicalRecordCode: "",
  firstNames: "",
  lastNames: "",
  dateOfBirth: "",
  sex: "unknown",
  phone: "",
  diabetesDiagnosisDate: "",
  diabetesType: "unknown",
  notes: "",
};

export function PatientForm({ patient, disabled, onCancel, onSubmit }: PatientFormProps) {
  const [form, setForm] = useState<PatientFormInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patient) {
      setForm(emptyForm);
      return;
    }

    setForm({
      internalIdentifier: patient.internalIdentifier,
      medicalRecordCode: patient.medicalRecordCode ?? "",
      firstNames: patient.firstNames,
      lastNames: patient.lastNames,
      dateOfBirth: patient.dateOfBirth,
      sex: patient.sex,
      phone: patient.phone ?? "",
      diabetesDiagnosisDate: patient.diabetesDiagnosisDate ?? "",
      diabetesType: patient.diabetesType,
      notes: patient.notes ?? "",
    });
  }, [patient]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setError(null);

    const parsed = patientFormSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise los datos del paciente.");
      return;
    }

    await onSubmit(parsed.data);
    setForm(emptyForm);
  }

  return (
    <form className="patient-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="form-heading">
        <h2>{patient ? "Editar paciente" : "Registrar paciente"}</h2>
        <p>Use solamente datos ficticios durante la beta de demostracion.</p>
      </div>

      <div className="form-grid">
        <label>
          Identificador interno
          <input
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, internalIdentifier: event.target.value }))}
            required
            value={form.internalIdentifier}
          />
        </label>

        <label>
          Codigo de expediente
          <input
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, medicalRecordCode: event.target.value }))}
            required
            value={form.medicalRecordCode}
          />
        </label>

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

      {error ? <div className="form-error">{error}</div> : null}

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
