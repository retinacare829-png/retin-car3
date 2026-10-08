import { z } from "zod";

export const patientPortalScreeningStatuses = [
  "BORRADOR",
  "CAPTURA_PENDIENTE",
  "IMAGENES_COMPLETAS",
  "PENDIENTE_REVISION",
  "REVISADO",
  "SEGUIMIENTO_REQUERIDO",
  "CERRADO",
] as const;

export type PatientPortalScreeningStatus = (typeof patientPortalScreeningStatuses)[number];

export interface PatientPortalProfile {
  patientId: string;
  organizationId: string;
  organizationName: string;
  displayName: string;
  firstNames: string;
  lastNames: string;
  dateOfBirth: string;
  phone: string | null;
  email: string | null;
}

export interface PatientPortalScreening {
  id: string;
  recordCode: string;
  createdAt: string;
  status: PatientPortalScreeningStatus;
  statusLabel: string;
  reportPublished: boolean;
}

export interface PatientPortalReport {
  id: string;
  screeningId: string;
  recordCode: string;
  title: string;
  summary: string;
  nextStep: string | null;
  publishedAt: string;
  publishedBy: string | null;
}

export interface PatientPortalSnapshot {
  contractVersion: 1;
  profile: PatientPortalProfile;
  screenings: PatientPortalScreening[];
  reports: PatientPortalReport[];
}

/** The RPC derives patient identity from auth.uid(); no patient ID is sent by the browser. */
export interface PatientPortalAdapter {
  getSnapshot: () => Promise<PatientPortalSnapshot>;
}

const patientPortalSnapshotSchema = z.object({
  contractVersion: z.literal(1),
  profile: z.object({
    patientId: z.string().min(1),
    organizationId: z.string().min(1),
    organizationName: z.string().min(1),
    displayName: z.string().min(1),
    firstNames: z.string().min(1),
    lastNames: z.string().min(1),
    dateOfBirth: z.string().min(1),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  }),
  screenings: z.array(z.object({
    id: z.string().min(1),
    recordCode: z.string().min(1),
    createdAt: z.string().min(1),
    status: z.enum(patientPortalScreeningStatuses),
    statusLabel: z.string().min(1),
    reportPublished: z.boolean(),
  })),
  reports: z.array(z.object({
    id: z.string().min(1),
    screeningId: z.string().min(1),
    recordCode: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    nextStep: z.string().nullable(),
    publishedAt: z.string().min(1),
    publishedBy: z.string().nullable(),
  })),
});

export function parsePatientPortalSnapshot(value: unknown): PatientPortalSnapshot {
  return patientPortalSnapshotSchema.parse(value);
}
