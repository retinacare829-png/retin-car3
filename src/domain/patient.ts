import { z } from "zod";

export const patientSexValues = ["female", "male", "other", "unknown"] as const;
export const diabetesTypeValues = ["type_1", "type_2", "gestational", "other", "unknown"] as const;

export type PatientSex = (typeof patientSexValues)[number];
export type DiabetesType = (typeof diabetesTypeValues)[number];

export const patientSexLabels: Record<PatientSex, string> = {
  female: "Femenino",
  male: "Masculino",
  other: "Otro",
  unknown: "No especificado",
};

export const diabetesTypeLabels: Record<DiabetesType, string> = {
  type_1: "Tipo 1",
  type_2: "Tipo 2",
  gestational: "Gestacional",
  other: "Otro",
  unknown: "No conocido",
};

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use formato YYYY-MM-DD.");
const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullish()
    .transform((value) => (value ? value : null));

const patientEditableFieldsSchema = z.object({
  firstNames: z.string().trim().min(2).max(120),
  lastNames: z.string().trim().min(2).max(120),
  dateOfBirth: isoDateSchema,
  sex: z.enum(patientSexValues),
  phone: optionalText(32),
  diabetesDiagnosisDate: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value ? value : null)),
  diabetesType: z.enum(diabetesTypeValues),
  notes: optionalText(1000),
});

function validatePatientDates(
  value: { dateOfBirth: string; diabetesDiagnosisDate: string | null },
  context: z.RefinementCtx,
) {
  const today = new Date().toISOString().slice(0, 10);

  if (value.dateOfBirth > today) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La fecha de nacimiento no puede ser futura.",
      path: ["dateOfBirth"],
    });
  }

  if (value.diabetesDiagnosisDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.diabetesDiagnosisDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use formato YYYY-MM-DD.",
        path: ["diabetesDiagnosisDate"],
      });
    }

    if (value.diabetesDiagnosisDate > today) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de diagnostico no puede ser futura.",
        path: ["diabetesDiagnosisDate"],
      });
    }

    if (value.diabetesDiagnosisDate < value.dateOfBirth) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de diagnostico no puede ser anterior al nacimiento.",
        path: ["diabetesDiagnosisDate"],
      });
    }
  }
}

export const patientFormSchema = z
  .object({
    internalIdentifier: z.string().trim().min(2).max(64).optional(),
    medicalRecordCode: z.string().trim().min(2).max(64).optional(),
    ...patientEditableFieldsSchema.shape,
  })
  .superRefine(validatePatientDates);

export type PatientFormInput = z.input<typeof patientFormSchema>;
export type PatientFormData = z.output<typeof patientFormSchema>;
export const patientCreateSchema = patientEditableFieldsSchema.superRefine(validatePatientDates);
export const patientUpdateSchema = patientEditableFieldsSchema.superRefine(validatePatientDates);
export type PatientCreateData = z.output<typeof patientCreateSchema>;
export type PatientUpdateData = z.output<typeof patientUpdateSchema>;

export interface Patient extends Omit<PatientFormData, "internalIdentifier" | "medicalRecordCode"> {
  internalIdentifier: string;
  /** Legacy patient-level value retained for historical compatibility; new visits use Screening.recordCode. */
  medicalRecordCode: string | null;
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface PatientFilters {
  query: string;
  sex: PatientSex | "all";
  diabetesType: DiabetesType | "all";
  includeArchived: boolean;
}

export const defaultPatientFilters: PatientFilters = {
  query: "",
  sex: "all",
  diabetesType: "all",
  includeArchived: false,
};

export function filterPatients(patients: readonly Patient[], filters: PatientFilters): Patient[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return patients.filter((patient) => {
    if (!filters.includeArchived && patient.deletedAt) {
      return false;
    }

    if (filters.sex !== "all" && patient.sex !== filters.sex) {
      return false;
    }

    if (filters.diabetesType !== "all" && patient.diabetesType !== filters.diabetesType) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [
      patient.internalIdentifier,
      patient.medicalRecordCode,
      patient.firstNames,
      patient.lastNames,
      patient.phone ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query);
  });
}

export function getChangedPatientFields(previous: Patient, next: PatientUpdateData): string[] {
  const fields = Object.keys(next) as Array<keyof PatientUpdateData>;
  return fields.filter((field) => previous[field] !== next[field]);
}
