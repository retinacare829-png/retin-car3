import { Archive, Edit3, Images, RotateCcw, Search, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  defaultPatientFilters,
  diabetesTypeLabels,
  diabetesTypeValues,
  filterPatients,
  patientSexLabels,
  patientSexValues,
  type DiabetesType,
  type Patient,
  type PatientFilters,
  type PatientFormData,
  type PatientSex,
} from "../domain/patient";
import type { Role } from "../domain/roles";
import { usePatients } from "../hooks/usePatients";
import { PatientForm } from "./PatientForm";
import { ScreeningManagement } from "./ScreeningManagement";

interface PatientManagementProps {
  organizationId: string;
  role: Role;
  user: User;
}

export function PatientManagement({ organizationId, role, user }: PatientManagementProps) {
  const [filters, setFilters] = useState<PatientFilters>(defaultPatientFilters);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const patientsApi = usePatients(organizationId, role, user, filters.includeArchived, filters.query);

  const filteredPatients = useMemo(
    () => filterPatients(patientsApi.patients, filters),
    [filters, patientsApi.patients],
  );
  const selectedPatient = filteredPatients.find((patient) => patient.id === selectedPatientId) ?? null;

  useEffect(() => {
    if (!selectedPatientId && filteredPatients[0]) {
      setSelectedPatientId(filteredPatients[0].id);
    }
  }, [filteredPatients, selectedPatientId]);

  async function handleSubmit(data: PatientFormData) {
    if (editingPatient) {
      await patientsApi.updatePatient(editingPatient, data);
      setEditingPatient(null);
      return;
    }

    await patientsApi.createPatient(data);
  }

  return (
    <section className="patient-module" aria-labelledby="patients-title">
      <div className="module-heading">
        <div>
          <p className="eyebrow">Fase 2</p>
          <h2 id="patients-title">Gestion de pacientes</h2>
          <p>Identidad del paciente separada de estudios e imagenes futuras.</p>
        </div>
        <button
          className="primary-button"
          disabled={!patientsApi.canWritePatients || patientsApi.saving}
          onClick={() => setEditingPatient(null)}
          type="button"
        >
          <UserRoundPlus aria-hidden="true" size={18} />
          Nuevo paciente
        </button>
      </div>

      <div className="patient-content">
        <PatientForm
          disabled={!patientsApi.canWritePatients || patientsApi.saving}
          onCancel={() => setEditingPatient(null)}
          onSubmit={handleSubmit}
          patient={editingPatient}
        />

        <div className="patient-list-panel">
          <div className="filters-row">
            <label className="search-field">
              Buscar
              <span>
                <Search aria-hidden="true" size={18} />
                <input
                  onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                  placeholder="Nombre, codigo o expediente"
                  value={filters.query}
                />
              </span>
            </label>

            <label>
              Sexo
              <select
                onChange={(event) =>
                  setFilters((current) => ({ ...current, sex: event.target.value as PatientSex | "all" }))
                }
                value={filters.sex}
              >
                <option value="all">Todos</option>
                {patientSexValues.map((value) => (
                  <option key={value} value={value}>
                    {patientSexLabels[value]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Diabetes
              <select
                onChange={(event) =>
                  setFilters((current) => ({ ...current, diabetesType: event.target.value as DiabetesType | "all" }))
                }
                value={filters.diabetesType}
              >
                <option value="all">Todas</option>
                {diabetesTypeValues.map((value) => (
                  <option key={value} value={value}>
                    {diabetesTypeLabels[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="checkbox-field">
              <input
                checked={filters.includeArchived}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, includeArchived: event.target.checked }))
                }
                type="checkbox"
              />
              Ver archivados
            </label>
          </div>

          {patientsApi.error ? <div className="form-error">{patientsApi.error}</div> : null}
          {patientsApi.loading ? <p className="empty-state">Cargando pacientes...</p> : null}
          {!patientsApi.loading && filteredPatients.length === 0 ? (
            <p className="empty-state">No hay pacientes que coincidan con los filtros.</p>
          ) : null}

          <div className="patient-table" role="table" aria-label="Pacientes registrados">
            {filteredPatients.map((patient) => (
              <article className={patient.deletedAt ? "patient-row archived" : "patient-row"} key={patient.id}>
                <div>
                  <strong>
                    {patient.lastNames}, {patient.firstNames}
                  </strong>
                  <span>
                    {patient.internalIdentifier} - {patient.medicalRecordCode}
                  </span>
                </div>
                <div>
                  <span>{patientSexLabels[patient.sex]}</span>
                  <span>{diabetesTypeLabels[patient.diabetesType]}</span>
                </div>
                <div>
                  <span>Nacimiento: {patient.dateOfBirth}</span>
                  <span>{patient.deletedAt ? "Archivado" : "Activo"}</span>
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    disabled={Boolean(patient.deletedAt)}
                    onClick={() => setSelectedPatientId(patient.id)}
                    title="Ver screenings"
                    type="button"
                  >
                    <Images aria-hidden="true" size={18} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={!patientsApi.canWritePatients || patientsApi.saving || Boolean(patient.deletedAt)}
                    onClick={() => setEditingPatient(patient)}
                    title="Editar paciente"
                    type="button"
                  >
                    <Edit3 aria-hidden="true" size={18} />
                  </button>
                  {patient.deletedAt ? (
                    <button
                      className="icon-button"
                      disabled={!patientsApi.canWritePatients || patientsApi.saving}
                      onClick={() => void patientsApi.restorePatient(patient.id)}
                      title="Restaurar paciente"
                      type="button"
                    >
                      <RotateCcw aria-hidden="true" size={18} />
                    </button>
                  ) : (
                    <button
                      className="icon-button danger"
                      disabled={!patientsApi.canWritePatients || patientsApi.saving}
                      onClick={() => void patientsApi.archivePatient(patient.id)}
                      title="Archivar paciente"
                      type="button"
                    >
                      <Archive aria-hidden="true" size={18} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {selectedPatient ? (
        <ScreeningManagement organizationId={organizationId} patient={selectedPatient} role={role} user={user} />
      ) : null}
    </section>
  );
}
