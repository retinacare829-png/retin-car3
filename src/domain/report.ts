export const reportStatusValues = [
  "BORRADOR",
  "CAPTURA_PENDIENTE",
  "IMAGENES_COMPLETAS",
  "PENDIENTE_REVISION",
  "REVISADO",
  "SEGUIMIENTO_REQUERIDO",
  "CERRADO",
] as const;

export type ReportStatus = (typeof reportStatusValues)[number];

export const reportStatusLabels: Record<ReportStatus, string> = {
  BORRADOR: "Borrador",
  CAPTURA_PENDIENTE: "Captura pendiente",
  IMAGENES_COMPLETAS: "Imágenes completas",
  PENDIENTE_REVISION: "Pendiente de revisión",
  REVISADO: "Revisado",
  SEGUIMIENTO_REQUERIDO: "Seguimiento requerido",
  CERRADO: "Cerrado",
};

export type ReportData = {
  patients: ReportPatient[];
  screenings: ReportScreening[];
  reviews: ReportReview[];
  followUps: ReportFollowUp[];
  images: ReportImage[];
};

export interface ReportPatient {
  id: string;
  internalIdentifier: string;
  medicalRecordCode: string;
  firstNames: string;
  lastNames: string;
  dateOfBirth: string;
  createdAt: string;
}

export interface ReportScreening {
  id: string;
  patientId: string;
  status: ReportStatus;
  createdAt: string;
  closedAt: string | null;
}

export interface ReportReview {
  id: string;
  patientId: string;
  screeningId: string;
  reviewStatus: string;
  reviewedAt: string | null;
}

export interface ReportFollowUp {
  id: string;
  patientId: string;
  screeningId: string;
  followUpType: string;
  followUpStatus: string;
  dueDate: string | null;
}

export interface ReportImage {
  id: string;
  patientId: string;
  screeningId: string;
  laterality: "OD" | "OI";
  status: string;
}

export const reportFollowUpLabels: Record<string, string> = {
  CONTROL_PROGRAMADO: "Control programado",
  REPETIR_ESTUDIO: "Repetir estudio",
  REFERIR_OFTALMOLOGIA: "Referencia a oftalmología",
};

export const reportReviewLabels: Record<string, string> = {
  PENDIENTE_REVISION: "Pendiente de revisión",
  EN_REVISION: "En revisión",
  REVISION_COMPLETADA: "Revisión completada",
  REQUIERE_RECAPTURA: "Requiere recaptura",
  SEGUIMIENTO_REQUERIDO: "Seguimiento requerido",
  CERRADO: "Cerrado",
};
