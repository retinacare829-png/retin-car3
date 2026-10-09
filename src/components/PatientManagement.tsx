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
  type PatientCreateData,
  type PatientFilters,
  type PatientSex,
} from "../domain/patient";
import type { Role } from "../domain/roles";
import { can } from "../domain/permissions";
import { usePatients } from "../hooks/usePatients";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { PatientForm, type PatientFormSubmission } from "./PatientForm";
import { PatientPortalAccessPanel } from "./PatientPortalAccessPanel";
import { ScreeningManagement } from "./ScreeningManagement";
import { EmptyState, ErrorNotice, LoadingState, StatusBadge } from "./ui";

interface PatientManagementProps {
  organizationId: string;
  role: Role;
  user: User;
  initialFocus?: "patients" | "screenings" | "workflow";
  initialQuery?: string;
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isPatientCreateData(data: PatientFormSubmission): data is PatientCreateData {
  return typeof data.phone === "string" && /^\d{8}$/.test(data.phone);
}

export function PatientManagement({ organizationId, role, user, initialFocus = "patients", initialQuery = "" }: PatientManagementProps) {
  const reducedMotion = useReducedMotion();
  const [filters, setFilters] = useState<PatientFilters>({ ...defaultPatientFilters, query: initialQuery });
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"name" | "recent">("name");
  const [creationRequestId, setCreationRequestId] = useState(createRequestId);
  const [creationConfirmation, setCreationConfirmation] = useState<{ internalIdentifier: string } | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const patientsApi = usePatients(organizationId, role, user, filters.includeArchived, filters.query);
  const { loadPatientPortalAccount } = patientsApi;

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
  useEffect(() => { setFilters((current) => current.query === initialQuery ? current : { ...current, query: initialQuery }); }, [initialQuery]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => {
    if (role === "clinic_admin" && selectedPatient) {
      void loadPatientPortalAccount(selectedPatient.id);
    }
  }, [loadPatientPortalAccount, role, selectedPatient]);

  async function handleSubmit(data: PatientFormSubmission) {
    if (editingPatient) {
      await patientsApi.updatePatient(editingPatient, data);
      setEditingPatient(null);
      return;
    }

    if (!isPatientCreateData(data)) {
      throw new Error("El teléfono del nuevo paciente debe tener 8 dígitos.");
    }
    const created = await patientsApi.createPatient(data, creationRequestId);
    setSelectedPatientId(created.id);
    setCreationConfirmation({ internalIdentifier: created.internalIdentifier });
    setCreationRequestId(createRequestId());
  }

  function focusPatientSearch() {
    globalThis.requestAnimationFrame(() => document.getElementById("patient-search")?.focus());
  }

  return (
    <section className="patient-module" aria-labelledby="patients-title">
      <div className="module-heading page-heading">
        <div>
          <p className="eyebrow">Pacientes · Ficha clínica</p>
          <h1 id="patients-title">Gestión de pacientes</h1>
          <p>Busque una ficha y continúe hacia sus screenings y workflow clínico.</p>
        </div>
        {patientsApi.canWritePatients ? <button
          className="primary-button"
          disabled={patientsApi.saving}
          onClick={() => {
            setEditingPatient(null); setCreationConfirmation(null); setCreationRequestId(createRequestId());
            globalThis.requestAnimationFrame(() => {
              const form = document.getElementById("patient-registration-form");
              form?.querySelector<HTMLInputElement>("input:not([readonly]):not([disabled])")?.focus({ preventScroll: true });
              form?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
            });
          }}
          type="button"
        >
          <UserRoundPlus aria-hidden="true" size={18} />
          Nuevo paciente
        </button> : null}
      </div>

      <div className={patientsApi.canWritePatients ? "patient-content" : "patient-content patient-content-readonly"}>
        {patientsApi.canWritePatients ? <PatientForm
          disabled={!patientsApi.canWritePatients || patientsApi.saving}
          onCancel={() => { setEditingPatient(null); setCreationConfirmation(null); setCreationRequestId(createRequestId()); }}
          onFocusExistingPatient={focusPatientSearch}
          onSubmit={handleSubmit}
          patient={editingPatient}
          previewCodes={patientsApi.previewCodes}
        /> : null}

        <div className="patient-list-panel">
          <div className="clinical-panel-heading">
            <div><p className="eyebrow">Directorio clínico</p><h2>Fichas registradas</h2></div>
            <span className="clinical-count">{filteredPatients.length} {filteredPatients.length === 1 ? "paciente" : "pacientes"}</span>
          </div>
          <div className="filters-row">
            <label className="search-field">
              Buscar
              <span>
                <Search aria-hidden="true" size={18} />
                <input
                  aria-label="Buscar paciente por nombre o identificador"
                  id="patient-search"
                  onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                  placeholder="Nombre o identificador"
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
            <EmptyState icon={Search} title={filters.query ? "Sin coincidencias" : "Aún no hay pacientes"} description={filters.query ? "Pruebe con otro nombre o identificador." : "Registre el primer paciente autorizado para comenzar el flujo."} />
          ) : null}

          <div className="patient-table" role="table" aria-label="Pacientes registrados">
            <div className="patient-table-heading" role="row">
              <span role="columnheader">Paciente</span>
              <span role="columnheader">Datos clínicos</span>
              <span role="columnheader">Ficha</span>
              <span role="columnheader">Acciones</span>
            </div>
            {visiblePatients.map((patient) => (
              <article className={`patient-row${patient.deletedAt ? " archived" : ""}${patient.id === selectedPatientId ? " selected" : ""}`} key={patient.id} role="row">
                <div className="patient-identity" role="cell">
                  <span className="clinical-avatar" aria-hidden="true">{patient.firstNames.slice(0, 1)}{patient.lastNames.slice(0, 1)}</span>
                  <div>
                  <strong>
                    {patient.lastNames}, {patient.firstNames}
                  </strong>
                  <span>
                    Identificador: {patient.internalIdentifier}
                  </span>
                  </div>
                </div>
                <div className="patient-clinical-data" role="cell">
                  <span>{patientSexLabels[patient.sex]}</span>
                  <span>{diabetesTypeLabels[patient.diabetesType]}</span>
                </div>
                <div className="patient-record-data" role="cell">
                  <span>Nacimiento: {patient.dateOfBirth}</span>
                  <StatusBadge label={patient.deletedAt ? "Archivado" : "Activo"} tone={patient.deletedAt ? "neutral" : "complete"} />
                </div>
                <div className="row-actions" role="cell">
                  <button
                    className="icon-button"
                    aria-label={`Ver screenings de ${patient.firstNames} ${patient.lastNames}`}
                    disabled={Boolean(patient.deletedAt)}
                    aria-pressed={patient.id === selectedPatientId}
                    onClick={() => setSelectedPatientId(patient.id)}
                    title="Ver screenings"
                    type="button"
                  >
                    <Images aria-hidden="true" size={18} />
                  </button>
                  {patientsApi.canWritePatients ? <button
                    className="icon-button"
                    aria-label={`Editar ficha de ${patient.firstNames} ${patient.lastNames}`}
                    disabled={!patientsApi.canWritePatients || patientsApi.saving || Boolean(patient.deletedAt)}
                    onClick={() => setEditingPatient(patient)}
                    title="Editar paciente"
                    type="button"
                  >
                    <Edit3 aria-hidden="true" size={18} />
                  </button> : null}
                  {patientsApi.canWritePatients && patient.deletedAt ? (
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
                  ) : patientsApi.canWritePatients ? (
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
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {filteredPatients.length > pageSize ? <nav className="table-pagination" aria-label="Paginación de pacientes"><span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredPatients.length)} de {filteredPatients.length}</span><div><button className="icon-button" aria-label="Página anterior" disabled={page === 1} onClick={() => setPage((current) => current - 1)} type="button"><ChevronLeft size={18} /></button><span>Página {page} de {totalPages}</span><button className="icon-button" aria-label="Página siguiente" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} type="button"><ChevronRight size={18} /></button></div></nav> : null}
        </div>
      </div>

      {creationConfirmation ? (
        <div className="patient-creation-confirmation" role="status">
          Paciente registrado. Identificador confirmado: <strong>{creationConfirmation.internalIdentifier}</strong>.
          El primer expediente se muestra en el screening generado abajo.
        </div>
      ) : null}

      {selectedPatient ? (
        <>
          <div className="selected-patient-cta" role="region" aria-label="Paciente seleccionado">
            <span className="clinical-avatar" aria-hidden="true">{selectedPatient.firstNames.slice(0, 1)}{selectedPatient.lastNames.slice(0, 1)}</span>
            <div><span className="eyebrow">Paciente seleccionado · {selectedPatient.internalIdentifier}</span><strong>{selectedPatient.lastNames}, {selectedPatient.firstNames}</strong><p>Desde aquí puede registrar una nueva visita o continuar con sus screenings.</p></div>
            {can(role, "screenings:create") ? <button className="secondary-button" onClick={() => document.getElementById("new-screening-form")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })} type="button"><Images aria-hidden="true" size={17} />Nueva visita</button> : null}
          </div>
          {role === "clinic_admin" ? (
            <PatientPortalAccessPanel
              account={patientsApi.patientPortalAccount}
              disabled={patientsApi.saving || Boolean(selectedPatient.deletedAt)}
              loading={patientsApi.patientPortalLoading}
              onLink={(userId) => patientsApi.linkPatientPortalAccount(selectedPatient.id, userId)}
              onRevoke={() => patientsApi.revokePatientPortalAccount(selectedPatient.id)}
            />
          ) : null}
          <ScreeningManagement initialFocus={initialFocus} organizationId={organizationId} patient={selectedPatient} role={role} user={user} />
        </>
      ) : null}
    </section>
  );
}
