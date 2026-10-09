import {
  Archive,
  Download,
  Eye,
  FileImage,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Patient } from "../domain/patient";
import type { Role } from "../domain/roles";
import {
  imageQualityReasonLabels,
  imageQualityReasonValues,
  imageQualityStatusLabels,
  imageQualityStatusValues,
  retinalImageLateralityLabels,
  retinalImageLateralityValues,
  screeningFormSchema,
  screeningStatusLabels,
  screeningStatusValues,
  type ImageQualityReason,
  type ImageQualityReviewInput,
  type ImageQualityStatus,
  type RetinalImage,
  type RetinalImageLaterality,
  type Screening,
  type ScreeningFormInput,
} from "../domain/screening";
import { useScreenings } from "../hooks/useScreenings";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { validateRetinalImageFile } from "../domain/supabaseIntegration";
import { getStatusTone } from "../domain/statusTone";
import { ClinicalWorkflow } from "./ClinicalWorkflow";
import { RetinalAnalysisPanel } from "./RetinalAnalysisPanel";
import { AnimatedFolder } from "./AnimatedFolder";
import { createRetinalReportService } from "../services/retinalReportService";
import { supabase } from "../lib/supabase";
import { EmptyState, ErrorNotice, LoadingState, StatusBadge } from "./ui";
import "./ImageCaptureControl.css";

interface ScreeningManagementProps {
  organizationId: string;
  patient: Patient;
  role: Role;
  user: User;
  initialFocus?: "patients" | "screenings" | "workflow";
}

const defaultScreeningForm = (patientId: string): ScreeningFormInput => ({
  patientId,
  status: "CAPTURA_PENDIENTE",
  generalObservations: "",
  assignedReviewerId: "",
});

export function ScreeningManagement({ organizationId, patient, role, user, initialFocus = "screenings" }: ScreeningManagementProps) {
  const reducedMotion = useReducedMotion();
  const screeningsApi = useScreenings(organizationId, role, user, patient.id);
  const [editingScreening, setEditingScreening] = useState<Screening | null>(null);
  const [activeScreeningId, setActiveScreeningId] = useState<string | null>(null);
  const [form, setForm] = useState<ScreeningFormInput>(defaultScreeningForm(patient.id));
  const [formError, setFormError] = useState<string | null>(null);
  const activeScreening = screeningsApi.screenings.find((screening) => screening.id === activeScreeningId) ?? null;

  useEffect(() => {
    setForm(defaultScreeningForm(patient.id));
    setEditingScreening(null);
    setActiveScreeningId(null);
  }, [patient.id]);

  useEffect(() => {
    if (!activeScreeningId && screeningsApi.screenings[0]) {
      setActiveScreeningId(screeningsApi.screenings[0].id);
    }
  }, [activeScreeningId, screeningsApi.screenings]);

  useEffect(() => {
    if (initialFocus === "patients" || (initialFocus === "workflow" && !activeScreeningId)) return;
    const targetId = initialFocus === "workflow" ? "clinical-workflow-title" : "screenings-title";
    const frame = globalThis.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }));
    return () => globalThis.cancelAnimationFrame(frame);
  }, [activeScreeningId, initialFocus, reducedMotion]);

  useEffect(() => {
    if (!editingScreening) {
      setForm(defaultScreeningForm(patient.id));
      return;
    }

    setForm({
      patientId: editingScreening.patientId,
      status: editingScreening.status,
      generalObservations: editingScreening.generalObservations ?? "",
      assignedReviewerId: editingScreening.assignedReviewerId ?? "",
    });
  }, [editingScreening, patient.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (screeningsApi.saving) return;
    setFormError(null);
    const parsed = screeningFormSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Revise los datos del screening.");
      return;
    }

    try {
      if (editingScreening) {
        await screeningsApi.updateScreening(editingScreening, parsed.data);
        setEditingScreening(null);
        return;
      }

      await screeningsApi.createScreening(parsed.data);
      setForm(defaultScreeningForm(patient.id));
    } catch {
      // El hook muestra el error y conserva los datos para que se pueda reintentar.
    }
  }

  return (
    <section className="screening-module" aria-labelledby="screenings-title" data-initial-focus={initialFocus}>
      <div className="module-heading">
        <div>
          <p className="eyebrow">Paciente / Screenings</p>
          <h2 id="screenings-title">Screenings e imágenes</h2>
          <p>
            {patient.lastNames}, {patient.firstNames} · Identificador {patient.internalIdentifier}
          </p>
        </div>
      </div>

      {screeningsApi.error ? <ErrorNotice message={screeningsApi.errorKind === "load" ? "No se pudo cargar la información del screening. Intente nuevamente." : screeningsApi.error} onRetry={screeningsApi.errorKind === "load" ? () => void screeningsApi.reload() : undefined} /> : null}

      <div className="screening-layout">
        <form className="screening-form" id="new-screening-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-heading">
            <h2>{editingScreening ? "Actualizar screening" : "Nuevo screening"}</h2>
            <p className="field-help">Esta visita queda asociada a la ficha del paciente. Después podrá cargar las imágenes de ambos ojos y registrar su calidad.</p>
          </div>

          <label>
            Estado
            <select
              disabled={screeningsApi.saving || (!screeningsApi.canCreateScreenings && !screeningsApi.canUpdateScreenings)}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as ScreeningFormInput["status"] }))
              }
              value={form.status}
            >
              {screeningStatusValues.filter((status) => status !== "CERRADO").map((status) => (
                <option key={status} value={status}>
                  {screeningStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Observaciones generales
            <textarea
              disabled={screeningsApi.saving || (!screeningsApi.canCreateScreenings && !screeningsApi.canUpdateScreenings)}
              maxLength={1200}
              onChange={(event) => setForm((current) => ({ ...current, generalObservations: event.target.value }))}
              rows={4}
              value={form.generalObservations ?? ""}
            />
          </label>

          <div className="form-actions">
            <button
              className="primary-button"
              disabled={screeningsApi.saving || (!screeningsApi.canCreateScreenings && !screeningsApi.canUpdateScreenings)}
              type="submit"
            >
              <Save aria-hidden="true" size={18} />
              {editingScreening ? "Guardar" : "Crear"}
            </button>
            <button
              className="ghost-button"
              disabled={screeningsApi.saving}
              onClick={() => setEditingScreening(null)}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={18} />
              Limpiar
            </button>
          </div>
          {formError ? <div className="form-error" role="alert">{formError}</div> : null}
        </form>

        <div className="screening-list-panel">
          <div className="clinical-panel-heading">
            <div><p className="eyebrow">Historial de visitas</p><h3>Expedientes del paciente</h3></div>
            <span className="clinical-count">{screeningsApi.screenings.length} {screeningsApi.screenings.length === 1 ? "visita" : "visitas"}</span>
          </div>
          {screeningsApi.loading ? <LoadingState label="Cargando screenings" /> : null}
          {!screeningsApi.loading && screeningsApi.screenings.length === 0 ? (
            <EmptyState icon={FileImage} title="Sin screenings" description="Cree el primer screening de este paciente para comenzar la captura OD/OI." />
          ) : null}

          <div className="screening-list">
            {screeningsApi.screenings.map((screening) => (
              <article
                className={screening.id === activeScreeningId ? "screening-row active" : "screening-row"}
                key={screening.id}
              >
                <button
                  className="screening-summary-button"
                  aria-pressed={screening.id === activeScreeningId}
                  onClick={() => setActiveScreeningId(screening.id)}
                  type="button"
                >
                  <StatusBadge label={screeningStatusLabels[screening.status]} tone={getStatusTone(screening.status)} />
                  <strong>Expediente {screening.recordCode}</strong>
                  <span>{new Date(screening.createdAt).toLocaleDateString()}</span>
                </button>
                <div className="screening-row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Editar screening ${screening.recordCode}`}
                    disabled={!screeningsApi.canUpdateScreenings || screeningsApi.saving || screening.status === "CERRADO"}
                    onClick={() => {
                      setEditingScreening(screening);
                      setActiveScreeningId(screening.id);
                    }}
                    title="Editar screening"
                    type="button"
                  >
                    <Eye aria-hidden="true" size={18} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Archivar screening ${screening.recordCode}`}
                    disabled={!screeningsApi.canDeleteImages || screeningsApi.saving || screening.status === "CERRADO"}
                    onClick={() => { if (globalThis.confirm("¿Archivar este screening? Las imágenes y el historial permanecerán trazables.")) void screeningsApi.deleteScreening(screening); }}
                    title="Archivar screening"
                    type="button"
                  >
                    <Archive aria-hidden="true" size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {activeScreening ? (
        <>
          <ScreeningWorkspace activeScreening={activeScreening} screeningsApi={screeningsApi} />
          <ClinicalWorkflow
            onScreeningChanged={screeningsApi.reload}
            organizationId={organizationId}
            patient={patient}
            role={role}
            screening={activeScreening}
            user={user}
          />
        </>
      ) : null}

      <PatientTimeline events={screeningsApi.timeline} />
    </section>
  );
}

interface ScreeningWorkspaceProps {
  activeScreening: ReturnType<typeof useScreenings>["screenings"][number];
  screeningsApi: ReturnType<typeof useScreenings>;
}

const retinalReports = supabase ? createRetinalReportService(supabase) : undefined;

function ScreeningWorkspace({ activeScreening, screeningsApi }: ScreeningWorkspaceProps) {
  const [activeLaterality, setActiveLaterality] = useState<RetinalImageLaterality>("OD");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUrlError, setImageUrlError] = useState<string | null>(null);
  const selectedImage =
    activeScreening.images.find((image) => image.laterality === activeLaterality && image.status === "ACTIVA") ?? null;
  const selectedQuality = selectedImage
    ? activeScreening.qualityReviews.find((review) => review.retinalImageId === selectedImage.id)
    : null;

  useEffect(() => {
    setImageUrl(null);
    setImageUrlError(null);

    if (!selectedImage) {
      return;
    }

    let active = true;
    screeningsApi
      .createSignedImageUrl(selectedImage)
      .then((signedUrl) => {
        if (active) {
          setImageUrl(signedUrl);
        }
      })
      .catch((caught) => {
        if (active) {
          setImageUrlError(caught instanceof Error ? caught.message : "No se pudo abrir la imagen.");
        }
      });

    return () => {
      active = false;
    };
  }, [screeningsApi, selectedImage]);

  return (
    <div className="screening-workspace">
      <div className="clinical-panel-heading screening-workspace-heading">
        <div><p className="eyebrow">Captura y calidad</p><h3>Expediente {activeScreening.recordCode}</h3><p>Revise cada ojo y registre la calidad de la imagen seleccionada.</p></div>
        <StatusBadge label={screeningStatusLabels[activeScreening.status]} tone={getStatusTone(activeScreening.status)} />
      </div>
      <div className="image-capture-panel">
        <div className="panel-title">
          <FileImage aria-hidden="true" size={20} />
          <h3>Imagenes retinales</h3>
        </div>
        <p className="field-help">Cargue una imagen por ojo. Puede reemplazar la captura antes del cierre.</p>
        {retinalImageLateralityValues.map((laterality) => {
          const image = activeScreening.images.find((item) => item.laterality === laterality && item.status === "ACTIVA");
          return (
            <ImageCaptureControl
              image={image ?? null}
              key={laterality}
              laterality={laterality}
              onDelete={(targetImage) => screeningsApi.deleteImage(targetImage)}
              onUpload={(file) => screeningsApi.uploadOrReplaceImage(activeScreening, laterality, file)}
              saving={screeningsApi.saving}
              canDelete={screeningsApi.canDeleteImages && activeScreening.status !== "CERRADO"}
              canUpload={screeningsApi.canUploadImages && activeScreening.status !== "CERRADO"}
            />
          );
        })}
      </div>

      <ImageViewer
        activeLaterality={activeLaterality}
        image={selectedImage}
        imageUrl={imageUrl}
        imageUrlError={imageUrlError}
        canUpload={screeningsApi.canUploadImages && activeScreening.status !== "CERRADO"}
        saving={screeningsApi.saving}
        onUpload={(file) => screeningsApi.uploadOrReplaceImage(activeScreening, activeLaterality, file)}
        onDownload={() => {
          if (imageUrl) {
            globalThis.open(imageUrl, "_blank", "noopener,noreferrer");
          }
        }}
        onLateralityChange={setActiveLaterality}
        qualityLabel={selectedQuality ? imageQualityStatusLabels[selectedQuality.qualityStatus] : "Pendiente"}
      />

      {selectedImage ? (
        <QualityReviewForm
          disabled={screeningsApi.saving || !screeningsApi.canRecordQuality || activeScreening.status === "CERRADO"}
          image={selectedImage}
          initialStatus={selectedQuality?.qualityStatus ?? "PENDIENTE"}
          initialReasons={selectedQuality?.reasons ?? []}
          onSubmit={(input) => screeningsApi.recordQualityReview(selectedImage, input)}
        />
      ) : null}

      {screeningsApi.canDownloadImages ? <RetinalAnalysisPanel
        key={`${activeScreening.organizationId}:${activeScreening.id}:${selectedImage?.id ?? activeLaterality}:${selectedImage?.updatedAt ?? ""}:${selectedImage?.storagePath ?? ""}`}
        image={selectedImage}
        qualityStatus={selectedQuality?.qualityStatus ?? "PENDIENTE"}
        getImageUrl={screeningsApi.createSignedImageUrl}
        reportService={retinalReports}
        readOnly={activeScreening.status === "CERRADO" || Boolean(activeScreening.patientPublishedAt)}
      /> : null}
    </div>
  );
}

interface ImageCaptureControlProps {
  laterality: RetinalImageLaterality;
  image: RetinalImage | null;
  canUpload: boolean;
  canDelete: boolean;
  saving: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (image: RetinalImage) => Promise<void>;
}

export function ImageCaptureControl({
  laterality,
  image,
  canUpload,
  canDelete,
  saving,
  onUpload,
  onDelete,
}: ImageCaptureControlProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const hintId = `image-upload-hint-${laterality}`;
  const errorId = `image-upload-error-${laterality}`;

  async function handleFileSelection(file: File) {
    if (!canUpload || saving || uploading) return;
    const validationError = validateRetinalImageFile(file);
    setUploadError(validationError);
    if (validationError) return;

    setUploading(true);
    try {
      await onUpload(file);
      setUploadError(null);
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={`image-capture-row${image ? " has-image" : ""}`} aria-busy={uploading}>
      <span className="capture-eye-marker" aria-hidden="true">{laterality}</span>
      <div className="capture-file-info">
        <strong>{retinalImageLateralityLabels[laterality]}</strong>
        <span>{image ? image.originalFileName : "Sin imagen"}</span>
        <small id={hintId}>JPG, PNG o WEBP · máximo 15 MB</small>
      </div>
      <label className="file-button">
        <Upload aria-hidden="true" size={18} />
        {uploading ? "Cargando…" : image ? "Reemplazar" : "Cargar"}
        <input
          accept="image/png,image/jpeg,image/webp"
          aria-label={`Cargar imagen ${laterality}`}
          aria-describedby={uploadError ? `${hintId} ${errorId}` : hintId}
          aria-invalid={Boolean(uploadError)}
          disabled={!canUpload || saving || uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void handleFileSelection(file);
          }}
          type="file"
        />
      </label>
      <button
        className="icon-button danger"
        aria-label={`Eliminar imagen ${laterality}`}
        disabled={!image || !canDelete || saving || uploading}
        onClick={() => {
          if (image && globalThis.confirm(`¿Retirar la imagen ${laterality}? Esta acción quedará registrada.`)) {
            void onDelete(image);
          }
        }}
        title="Eliminar imagen"
        type="button"
      >
        <Archive aria-hidden="true" size={18} />
      </button>
      {uploadError ? <p className="image-upload-error" id={errorId} role="alert">{uploadError}</p> : null}
    </div>
  );
}

interface ImageViewerProps {
  activeLaterality: RetinalImageLaterality;
  image: RetinalImage | null;
  imageUrl: string | null;
  imageUrlError: string | null;
  canUpload: boolean;
  saving: boolean;
  onUpload: (file: File) => Promise<void>;
  qualityLabel: string;
  onDownload: () => void;
  onLateralityChange: (laterality: RetinalImageLaterality) => void;
}

function ImageViewer({
  activeLaterality,
  image,
  imageUrl,
  imageUrlError,
  canUpload,
  saving,
  onUpload,
  qualityLabel,
  onDownload,
  onLateralityChange,
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setUploadError(null);
  }, [activeLaterality]);

  async function uploadFromViewer(file: File) {
    if (!canUpload || saving || uploading) return;
    const validationError = validateRetinalImageFile(file);
    setUploadError(validationError);
    if (validationError) return;
    setUploading(true);
    try {
      await onUpload(file);
      setUploadError(null);
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="image-viewer-panel">
      <div className="clinical-panel-heading viewer-heading">
        <div><p className="eyebrow">Visor retinal</p><h3>{retinalImageLateralityLabels[activeLaterality]}</h3></div>
        <span className="clinical-count">{qualityLabel}</span>
      </div>
      <div className="viewer-toolbar">
        <div className="segmented-control" role="group" aria-label="Seleccionar lateralidad">
          {retinalImageLateralityValues.map((laterality) => (
            <button
              className={laterality === activeLaterality ? "active" : ""}
              aria-pressed={laterality === activeLaterality}
              key={laterality}
              onClick={() => onLateralityChange(laterality)}
              type="button"
            >
              {laterality}
            </button>
          ))}
        </div>
        <div className="zoom-controls" role="group" aria-label="Controles de imagen">
          <button aria-label="Reducir zoom" className="icon-button" onClick={() => setZoom((current) => Math.max(1, current - 0.25))} type="button">
            <Minus aria-hidden="true" size={18} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="Aumentar zoom" className="icon-button" onClick={() => setZoom((current) => Math.min(3, current + 0.25))} type="button">
            <Plus aria-hidden="true" size={18} />
          </button>
          <button aria-label="Restablecer zoom" className="icon-button" onClick={() => setZoom(1)} title="Restablecer zoom" type="button">
            <Maximize2 aria-hidden="true" size={18} />
          </button>
          <button aria-label="Descargar imagen" className="icon-button" disabled={!imageUrl} onClick={onDownload} title="Descargar imagen" type="button">
            <Download aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      <div className="image-stage">
        {imageUrl ? (
          <img
            alt={retinalImageLateralityLabels[activeLaterality]}
            src={imageUrl}
            style={{ transform: `scale(${zoom})` }}
          />
        ) : null}
        {!imageUrl && !imageUrlError && image ? <LoadingState label="Abriendo imagen retinal" /> : null}
        {!imageUrl && !imageUrlError && !image ? <>
          <AnimatedFolder
            className="retinal-folder-upload"
            size="lg"
            inputLabel={`Cargar imagen ${activeLaterality} desde el visor`}
            label={`Sin imagen ${activeLaterality}`}
            description="Arrastrá una imagen retinal aquí o elegila desde tu dispositivo. JPG, PNG o WEBP · máximo 15 MB."
            buttonLabel={uploading ? "Cargando…" : "Elegir imagen"}
            disabled={!canUpload || saving}
            busy={uploading}
            invalid={Boolean(uploadError)}
            onFiles={(files) => { if (files[0]) void uploadFromViewer(files[0]); }}
          />
          {uploadError ? <span role="alert">{uploadError}</span> : null}
        </> : null}
        {imageUrlError ? <span role="alert">No fue posible abrir la imagen. Intente nuevamente.</span> : null}
      </div>

      <dl className="image-metadata">
        <div>
          <dt>Lateralidad</dt>
          <dd>{retinalImageLateralityLabels[activeLaterality]}</dd>
        </div>
        <div>
          <dt>Calidad</dt>
          <dd>{qualityLabel}</dd>
        </div>
        <div>
          <dt>MIME</dt>
          <dd>{image?.mimeType ?? "N/D"}</dd>
        </div>
        <div>
          <dt>Tamano</dt>
          <dd>{image ? `${Math.round(image.sizeBytes / 1024)} KB` : "N/D"}</dd>
        </div>
      </dl>
    </div>
  );
}

interface QualityReviewFormProps {
  image: RetinalImage;
  disabled: boolean;
  initialStatus: ImageQualityStatus;
  initialReasons: ImageQualityReason[];
  onSubmit: (input: ImageQualityReviewInput) => Promise<void>;
}

function QualityReviewForm({ image, disabled, initialStatus, initialReasons, onSubmit }: QualityReviewFormProps) {
  const [qualityStatus, setQualityStatus] = useState<ImageQualityStatus>(initialStatus);
  const [reasons, setReasons] = useState<ImageQualityReason[]>(initialReasons);
  const suggestion = qualityStatus === "INADECUADA" ? "Repetir captura" : null;

  useEffect(() => {
    setQualityStatus(initialStatus);
    setReasons(initialReasons);
  }, [initialReasons, initialStatus, image.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ retinalImageId: image.id, qualityStatus, reasons, otherReason: "" });
  }

  return (
    <form className="quality-panel" onSubmit={(event) => void handleSubmit(event)}>
      <div className="panel-title">
        <Eye aria-hidden="true" size={20} />
        <h3>Calidad de imagen</h3>
      </div>
      <p className="field-help">Evaluación de la captura {retinalImageLateralityLabels[image.laterality]}.</p>
      <label>
        Estado
        <select
          disabled={disabled}
          onChange={(event) => {
            const nextStatus = event.target.value as ImageQualityStatus;
            setQualityStatus(nextStatus);
            if (nextStatus !== "INADECUADA") {
              setReasons([]);
            }
          }}
          value={qualityStatus}
        >
          {imageQualityStatusValues.map((status) => (
            <option key={status} value={status}>
              {imageQualityStatusLabels[status]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="quality-reasons clinical-fieldset" aria-label="Motivos de calidad inadecuada">
        <legend>Motivos de calidad inadecuada</legend>
        {imageQualityReasonValues.map((reason) => (
          <label className="checkbox-field" key={reason}>
            <input
              checked={reasons.includes(reason)}
              disabled={disabled || qualityStatus !== "INADECUADA"}
              onChange={(event) =>
                setReasons((current) =>
                  event.target.checked ? [...current, reason] : current.filter((item) => item !== reason),
                )
              }
              type="checkbox"
            />
            {imageQualityReasonLabels[reason]}
          </label>
        ))}
      </fieldset>

      {suggestion ? <div className="form-message">{suggestion}</div> : null}

      <button className="primary-button" disabled={disabled} type="submit">
        <Save aria-hidden="true" size={18} />
        Registrar calidad
      </button>
    </form>
  );
}

function PatientTimeline({ events }: { events: ReturnType<typeof useScreenings>["timeline"] }) {
  const sortedEvents = useMemo(() => events.slice(0, 8), [events]);

  return (
    <section className="timeline-panel" aria-labelledby="timeline-title">
      <div className="clinical-panel-heading"><div><p className="eyebrow">Trazabilidad</p><h3 id="timeline-title">Timeline del paciente</h3></div></div>
      {sortedEvents.length === 0 ? <EmptyState title="Sin eventos en el timeline" description="Las acciones del paciente y sus screenings aparecerán aquí." /> : null}
      <ol>
        {sortedEvents.map((event) => (
          <li key={event.id}>
            <strong>{event.title}</strong>
            <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
