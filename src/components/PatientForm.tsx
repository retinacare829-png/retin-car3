import { FormEvent, useEffect, useState } from "react";
import {
  diabetesTypeLabels,
  diabetesTypeValues,
  patientCreateSchema,
  patientSexLabels,
  patientSexValues,
  patientUpdateSchema,
  type Patient,
  type PatientCodePreview,
  type PatientCreateData,
  type PatientFormInput,
  type PatientUpdateData,
} from "../domain/patient";

interface PatientFormProps {
  patient: Patient | null;
  disabled: boolean;
  onCancel: () => void;
  onFocusExistingPatient?: () => void;
  previewCodes?: PatientCodePreview | null;
  onSubmit: (data: PatientFormSubmission) => Promise<void>;
}

export type PatientFormSubmission = PatientCreateData | PatientUpdateData;

type PatientFormState = Omit<PatientFormInput, "medicalRecordCode">;
const PHONE_LENGTH = 8;
const NO_PHONE_VALUE = "00000000";

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
    return "No se pudo guardar la ficha porque el identificador del paciente ya existe (código 23505). Busque la ficha existente y edítela; no se fusionan fichas automáticamente.";
  }

  if (code === "42501") {
    return "No tiene permisos suficientes para guardar el paciente (código 42501).";
  }

  if (code === "23514") {
    return "Los datos del paciente no cumplen una regla de validación (código 23514). Revise el teléfono y las fechas.";
  }

  if (/^[A-Z0-9]{4,8}$/.test(code)) {
    return `No se pudo guardar el paciente (código ${code}). Revise los datos e intente nuevamente.`;
  }

  return "No se pudo guardar el paciente. Revise los datos e intente nuevamente.";
}

export function PatientForm({ patient, disabled, onCancel, onFocusExistingPatient, previewCodes, onSubmit }: PatientFormProps) {
  const [form, setForm] = useState<PatientFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [noPhoneSelected, setNoPhoneSelected] = useState(false);
  const [initialPhone, setInitialPhone] = useState("");
  const [legacyPhone, setLegacyPhone] = useState(false);

  useEffect(() => {
    if (!patient) {
      setForm(emptyForm);
      setError(null);
      setPhoneError(null);
      setNoPhoneSelected(false);
      setInitialPhone("");
      setLegacyPhone(false);
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
    setPhoneError(null);
    setInitialPhone(patient.phone ?? "");
    setLegacyPhone(Boolean(patient.phone && !/^\d{8}$/.test(patient.phone)));
    setNoPhoneSelected(patient.phone === NO_PHONE_VALUE);
  }, [patient]);

  function handlePhoneChange(value: string) {
    if (!/^\d*$/.test(value)) {
      setPhoneError("El teléfono solo puede contener dígitos.");
      return;
    }

    if (value.length > PHONE_LENGTH) {
      setPhoneError("El teléfono debe tener exactamente 8 dígitos.");
      return;
    }

    setForm((current) => ({ ...current, phone: value }));
    setNoPhoneSelected(value === NO_PHONE_VALUE);
    setPhoneError(value.length === 0 || value.length === PHONE_LENGTH ? null : "El teléfono debe tener exactamente 8 dígitos.");
  }

  function selectNoPhone() {
    setForm((current) => ({ ...current, phone: NO_PHONE_VALUE }));
    setNoPhoneSelected(true);
    setPhoneError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setError(null);
    setPhoneError(null);

    const currentPhone = form.phone ?? "";
    const preserveLegacyPhone = Boolean(patient && legacyPhone && currentPhone === initialPhone);
    if (!preserveLegacyPhone && !/^\d{8}$/.test(currentPhone)) {
      setPhoneError(currentPhone ? "El teléfono debe tener exactamente 8 dígitos." : "Ingrese un teléfono de 8 dígitos o seleccione «No tengo teléfono».");
      return;
    }

    const { internalIdentifier, ...editableFields } = form;
    void internalIdentifier;
    const parsedFields = preserveLegacyPhone ? { ...editableFields, phone: initialPhone } : editableFields;
    const parsed = patient ? patientUpdateSchema.safeParse(parsedFields) : patientCreateSchema.safeParse(parsedFields);
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
    <form className="patient-form" id="patient-registration-form" aria-labelledby="patient-form-title" onSubmit={(event) => void handleSubmit(event)}>
      <div className="form-heading">
        <p className="eyebrow">Ficha del paciente</p>
        <h2 id="patient-form-title">{patient ? "Editar paciente" : "Registrar paciente"}</h2>
        <p>Use solamente datos ficticios durante la beta de demostración.</p>
      </div>

      {!patient ? (
        <aside className="patient-form-guidance" role="note">
          <strong>¿La ficha ya existe?</strong>
          <p>Busque al paciente antes de crear otra ficha.</p>
          {onFocusExistingPatient ? <button className="text-button" onClick={onFocusExistingPatient} type="button">Buscar ficha existente</button> : null}
          <details><summary>Cómo se asignan los códigos</summary>
          <span>El identificador interno se asigna al guardar; el expediente se genera para cada visita.</span>
          <span>La vista previa puede cambiar si otra persona registra un paciente antes de guardar.</span>
          </details>
          {previewCodes ? (
            <span>
              Vista previa provisional: identificador {previewCodes.internalIdentifier} · primer expediente {previewCodes.recordCode}.
            </span>
          ) : null}
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

      <fieldset className="clinical-fieldset">
        <legend>Datos personales</legend>
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

        <label className="form-grid-wide">
          Teléfono
          <input
            aria-label="Teléfono"
            aria-describedby={phoneError ? "patient-phone-error" : undefined}
            aria-invalid={phoneError ? "true" : "false"}
            disabled={disabled}
            inputMode="numeric"
            maxLength={PHONE_LENGTH}
            minLength={noPhoneSelected ? undefined : PHONE_LENGTH}
            onChange={(event) => handlePhoneChange(event.target.value)}
            pattern={legacyPhone || noPhoneSelected ? undefined : "[0-9]{8}"}
            placeholder={noPhoneSelected ? "Sin teléfono" : "8 dígitos"}
            required={!noPhoneSelected}
            type="tel"
            value={noPhoneSelected ? "" : form.phone ?? ""}
          />
          <button className="text-button phone-fallback-button" disabled={disabled} onClick={selectNoPhone} type="button">
            {noPhoneSelected ? "Sin teléfono seleccionado" : "No tengo teléfono"}
          </button>
          {legacyPhone ? <span className="patient-phone-feedback legacy" role="status">Este teléfono histórico se conservará mientras no lo cambie. Para corregirlo, ingrese 8 dígitos.</span> : null}
          {noPhoneSelected ? <span className="patient-phone-feedback" role="status">Sin teléfono: se guardará como dato no disponible.</span> : null}
          {phoneError ? <span className="patient-phone-feedback error" id="patient-phone-error" role="alert">{phoneError}</span> : null}
        </label>

        </div>
      </fieldset>

      <fieldset className="clinical-fieldset">
        <legend>Antecedentes clínicos</legend>
        <div className="form-grid">
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
      </fieldset>

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
