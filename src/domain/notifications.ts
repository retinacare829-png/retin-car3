import type { Database } from "../lib/supabase";

export const NOTIFICATION_TIME_ZONE = "America/Managua";
export const NOTIFICATION_SOURCE_LIMIT = 20;
export const activeFollowUpStatuses = ["CONTROL_PROGRAMADO", "REPETIR_ESTUDIO", "REFERIR_OFTALMOLOGIA"] as const;

export type NotificationDestination = "workflow" | "reports";
export type NotificationFollowUp = Pick<Database["public"]["Tables"]["follow_ups"]["Row"],
  "id" | "organization_id" | "follow_up_type" | "follow_up_status" | "urgency" | "due_date" | "completed_at" | "deleted_at">;
export type NotificationReport = Pick<Database["public"]["Tables"]["screenings"]["Row"],
  "id" | "organization_id" | "patient_published_at" | "deleted_at">;

export interface ClinicNotification {
  id: string;
  kind: "follow_up_due" | "report_ready";
  title: string;
  detail: string;
  urgent: boolean;
  destination: NotificationDestination;
}

export interface NotificationSnapshot {
  today: string;
  items: ClinicNotification[];
  count: number;
  followUpCount: number;
  reportCount: number;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: NOTIFICATION_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const publicationFormatter = new Intl.DateTimeFormat("es-NI", {
  timeZone: NOTIFICATION_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const followUpLabels = {
  CONTROL_PROGRAMADO: "Control programado", REPETIR_ESTUDIO: "Repetir estudio", REFERIR_OFTALMOLOGIA: "Referencia a oftalmología",
};

export function notificationToday(now = new Date()): string {
  const parts = dayFormatter.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function buildClinicNotifications(
  organizationId: string, followUps: readonly NotificationFollowUp[], reports: readonly NotificationReport[], now = new Date(),
): ClinicNotification[] {
  const today = notificationToday(now);
  // due_date is a PostgreSQL date, never an instant to convert through the browser timezone.
  const dueLabel = today.split("-").reverse().join("/");
  const due = followUps.filter((row) => row.organization_id === organizationId && row.deleted_at === null
    && row.completed_at === null && row.due_date === today
    && activeFollowUpStatuses.some((status) => status === row.follow_up_status))
    .sort((a, b) => Number(b.urgency === "urgent") - Number(a.urgency === "urgent") || a.id.localeCompare(b.id))
    .map((row): ClinicNotification => ({
      id: `follow-up:${row.id}`, kind: "follow_up_due", title: "Seguimiento para hoy",
      detail: `${followUpLabels[row.follow_up_type]} · ${dueLabel}`, urgent: row.urgency === "urgent", destination: "workflow",
    }));
  const published = reports.filter((row) => row.organization_id === organizationId && row.deleted_at === null
    && row.patient_published_at !== null && Number.isFinite(Date.parse(row.patient_published_at))
    && Date.parse(row.patient_published_at) <= now.getTime())
    .sort((a, b) => Date.parse(b.patient_published_at!) - Date.parse(a.patient_published_at!) || a.id.localeCompare(b.id))
    .map((row): ClinicNotification => ({
      id: `report:${row.id}`, kind: "report_ready", title: "Reporte listo",
      detail: `Publicado el ${publicationFormatter.format(new Date(row.patient_published_at!))}`,
      urgent: false, destination: "reports",
    }));
  return [...due, ...published];
}
