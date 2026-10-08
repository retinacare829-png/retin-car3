export type PatientPortalPublishedStatus = "REVISADO" | "SEGUIMIENTO_REQUERIDO" | "CERRADO";

export interface PatientPortalProfile {
  id: string;
  internalIdentifier: string;
  firstNames: string;
  lastNames: string;
  dateOfBirth: string;
  sex: "female" | "male" | "other" | "unknown";
  phone: string | null;
}

export interface PatientPortalScreening {
  id: string;
  recordCode: string;
  status: PatientPortalPublishedStatus;
  publishedAt: string;
  createdAt: string;
  closedAt: string | null;
}

export interface PatientPortalReport {
  screeningId: string;
  recordCode: string;
  status: PatientPortalPublishedStatus;
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
}

export interface PatientPortalSnapshot {
  contractVersion: 1;
  profile: PatientPortalProfile;
  screenings: PatientPortalScreening[];
  reports: PatientPortalReport[];
}

export interface PatientPortalAccount {
  id: string;
  organizationId: string;
  patientId: string;
  userId: string;
  status: "active" | "suspended" | "revoked";
  createdBy: string;
  revokedBy: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}
