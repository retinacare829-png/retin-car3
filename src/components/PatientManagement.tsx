import { Archive, ChevronLeft, ChevronRight, Edit3, Images, RotateCcw, Search, UserRoundPlus } from "lucide-react";
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
import { EmptyState, ErrorNotice, LoadingState, StatusBadge } from "./ui";

interface PatientManagementProps {
  organizationId: string;
  role: Role;
  user: User;
  initialFocus?: "patients" | "screenings" | "workflow";
}

export function PatientManagement({ organizationId, role, user, initialFocus = "patients" }: PatientManagementProps) {
  const [filters, setFilters] = useState<PatientFilters>(defaultPatientFilters);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"name" | "recent">("name");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const patientsApi = usePatients(organizationId, role, user, filters.includeArchived, filters.query);

  const filteredPatients = useMemo(
    () => filterPatients(patientsApi.patients, filters).sort((a, b) => sortOrder === "name"
      ? `${a.lastNames} ${a.firstNames}`.localeCompare(`${b.lastNames} ${b.firstNames}`, "es")
      : b.createdAt.localeCompare(a.createdAt)),
    [filters, patientsApi.patients, sortOrder],
  );
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const visiblePatients = filteredPatients.slice((page - 1) * pageSize, page * pageSize);
  const selectedPatient = filteredPatients.find((patient) => patient.id === selectedPatientId) ?? null;

  useEffect(() => {
    if (!selectedPatientId && filteredPatients[0] && initialFocus !== "patients") {
      setSelectedPatientId(filteredPatients[0].id);
    }
  }, [filteredPatients, initialFocus, selectedPatientId]);

  useEffect(() => { setPage(1); }, [filters, sortOrder]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

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
      <div className="module-heading page-heading">
        <div>
          <p className="eyebrow">Pacientes · Ficha clínica</p>
          <h1 id="patients-title">Gestión de pacientes</h1>
          <p>Busque una ficha y continúe hacia sus screenings y workflow clínico.</p>
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

            <label>
              Ordenar
              <select onChange={(event) => setSortOrder(event.target.value as "name" | "recent")} value={sortOrder}>
                <option value="name">Nombre A–Z</option>
                <option value="recent">Más recientes</option>
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

          {patientsApi.error ? <ErrorNotice message="No se pudieron cargar los pacientes. Verifique su conexión e intente nuevamente." onRetry={() => void patientsApi.reload()} /> : null}
          {patientsApi.loading ? <LoadingState label="Cargando pacientes" /> : null}
          {!patientsApi.loading && filteredPatients.length === 0 ? (
            <EmptyState icon={Search} title={filters.query ? "Sin coincidencias" : "Aún no hay pacientes"} description={filters.query ? "Pruebe con otro nombre, código o expediente." : "Registre el primer paciente autorizado para comenzar el flujo."} />
          ) : null}

          <div className="patient-table" role="table" aria-label="Pacientes registrados">
            {visiblePatients.map((patient) => (
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
                  <StatusBadge label={patient.deletedAt ? "Archivado" : "Activo"} tone={patient.deletedAt ? "neutral" : "complete"} />
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Ver screenings de ${patient.firstNames} ${patient.lastNames}`}
                    disabled={Boolean(patient.deletedAt)}
                    onClick={() => setSelectedPatientId(patient.id)}
                    title="Ver screenings"
                    type="button"
                  >
                    <Images aria-hidden="true" size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Editar ficha de ${patient.firstNames} ${patient.lastNames}`}
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
                      aria-label={`Restaurar ficha de ${patient.firstNames} ${patient.lastNames}`}
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
                      aria-label={`Archivar ficha de ${patient.firstNames} ${patient.lastNames}`}
                      disabled={!patientsApi.canWritePatients || patientsApi.saving}
                      onClick={() => { if (globalThis.confirm(`¿Archivar la ficha de ${patient.firstNames} ${patient.lastNames}? Podrá restaurarla después.`)) void patientsApi.archivePatient(patient.id); }}
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
          {filteredPatients.length > pageSize ? <nav className="table-pagination" aria-label="Paginación de pacientes"><span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredPatients.length)} de {filteredPatients.length}</span><div><button className="icon-button" aria-label="Página anterior" disabled={page === 1} onClick={() => setPage((current) => current - 1)} type="button"><ChevronLeft size={18} /></button><span>Página {page} de {totalPages}</span><button className="icon-button" aria-label="Página siguiente" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} type="button"><ChevronRight size={18} /></button></div></nav> : null}
        </div>
      </div>

      {selectedPatient ? (
        <ScreeningManagement initialFocus={initialFocus} organizationId={organizationId} patient={selectedPatient} role={role} user={user} />
      ) : null}
    </section>
  );
}
