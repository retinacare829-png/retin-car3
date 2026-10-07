import type { DashboardData, DashboardStatus } from "../domain/dashboard";
import type { Database, TypedSupabaseClient } from "../lib/supabase";

type ScreeningRow = Pick<Database["public"]["Tables"]["screenings"]["Row"], "id" | "status" | "created_at">;
type ReviewRow = Pick<Database["public"]["Tables"]["professional_reviews"]["Row"], "id" | "review_status" | "created_at">;
type FollowUpRow = Pick<Database["public"]["Tables"]["follow_ups"]["Row"], "id" | "follow_up_type" | "follow_up_status" | "due_date" | "created_at">;

const pendingScreeningStatuses = new Set(["BORRADOR", "CAPTURA_PENDIENTE", "IMAGENES_COMPLETAS", "PENDIENTE_REVISION", "SEGUIMIENTO_REQUERIDO"]);
const reviewedStatuses = new Set(["REVISADO", "CERRADO"]);
const statusLabels: Record<string, string> = { BORRADOR: "Borrador", CAPTURA_PENDIENTE: "Captura pendiente", IMAGENES_COMPLETAS: "Imágenes completas", PENDIENTE_REVISION: "Pendiente de revisión", REVISADO: "Revisado", SEGUIMIENTO_REQUERIDO: "Seguimiento requerido", CERRADO: "Cerrado" };
const followUpLabels: Record<string, string> = { CONTROL_PROGRAMADO: "Control programado", REPETIR_ESTUDIO: "Repetir estudio", REFERIR_OFTALMOLOGIA: "Referencia a oftalmología" };

export class DashboardService {
  constructor(private readonly client: TypedSupabaseClient) {}

  async getDashboard(organizationId: string, now = new Date()): Promise<DashboardData> {
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday); endToday.setDate(endToday.getDate() + 1);
    const todayKey = `${startToday.getFullYear()}-${String(startToday.getMonth() + 1).padStart(2, "0")}-${String(startToday.getDate()).padStart(2, "0")}`;
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const [patientsResult, screeningsResult, reviewsResult, followUpsResult, timelineResult] = await Promise.all([
      this.client.from("patients").select("id, created_at").eq("organization_id", organizationId).is("deleted_at", null),
      this.client.from("screenings").select("id, status, created_at").eq("organization_id", organizationId).is("deleted_at", null),
      this.client.from("professional_reviews").select("id, review_status, created_at").eq("organization_id", organizationId).is("deleted_at", null),
      this.client.from("follow_ups").select("id, follow_up_type, follow_up_status, due_date, created_at").eq("organization_id", organizationId).is("deleted_at", null),
      this.client.from("patient_timeline_events").select("id, title, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(8),
    ]);
    for (const result of [patientsResult, screeningsResult, reviewsResult, followUpsResult, timelineResult]) if (result.error) throw result.error;
    const patients = patientsResult.data ?? [];
    const screenings = (screeningsResult.data ?? []) as ScreeningRow[];
    const reviews = (reviewsResult.data ?? []) as ReviewRow[];
    const followUps = (followUpsResult.data ?? []) as FollowUpRow[];
    const activeFollowUps = followUps.filter((item) => !["SEGUIMIENTO_COMPLETADO", "CANCELADO"].includes(item.follow_up_status));
    const pendingReviews = reviews.filter((item) => ["PENDIENTE_REVISION", "EN_REVISION", "REQUIERE_RECAPTURA"].includes(item.review_status));
    const isToday = (value: string | null) => Boolean(value && new Date(value) >= startToday && new Date(value) < endToday);

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat("es-NI", { month: "short" }).format(date).replace(".", ""), total: 0 };
    });
    screenings.filter((item) => new Date(item.created_at) >= sixMonthsAgo).forEach((item) => { const key = item.created_at.slice(0, 7); const month = months.find((entry) => entry.key === key); if (month) month.total += 1; });
    const distribution = new Map<string, number>();
    screenings.forEach((item) => distribution.set(item.status, (distribution.get(item.status) ?? 0) + 1));
    const statusDistribution: DashboardStatus[] = [...distribution].map(([status, total]) => ({ status, label: statusLabels[status] ?? status, total })).sort((a, b) => b.total - a.total);
    const agenda = [
      ...activeFollowUps.filter((item) => item.due_date === todayKey).map((item) => ({ id: `follow-${item.id}`, title: followUpLabels[item.follow_up_type] ?? "Seguimiento", detail: "Programado para hoy", occurredAt: `${item.due_date}T12:00:00`, priority: "high" as const })),
      ...pendingReviews.map((item) => ({ id: `review-${item.id}`, title: "Revisión pendiente", detail: "Requiere atención profesional", occurredAt: item.created_at, priority: item.review_status === "REQUIERE_RECAPTURA" ? "high" as const : "normal" as const })),
    ].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).slice(0, 8);

    return {
      totals: { patients: patients.length, screenings: screenings.length, pending: screenings.filter((item) => pendingScreeningStatuses.has(item.status)).length, reviewed: screenings.filter((item) => reviewedStatuses.has(item.status)).length, followUps: activeFollowUps.length },
      today: { pendingScreenings: screenings.filter((item) => pendingScreeningStatuses.has(item.status)).length, scheduledFollowUps: activeFollowUps.filter((item) => item.due_date === todayKey).length, pendingReviews: pendingReviews.length, newPatients: patients.filter((item) => isToday(item.created_at)).length },
      screeningsByMonth: months, statusDistribution,
      recentActivity: (timelineResult.data ?? []).map((item) => ({ id: item.id, title: item.title, occurredAt: item.created_at })), agenda,
      appointments: activeFollowUps
        .filter((item) => item.due_date)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
        .slice(0, 42)
        .map((item) => ({
          id: `appointment-${item.id}`,
          date: item.due_date as string,
          title: followUpLabels[item.follow_up_type] ?? "Cita clínica",
          detail: item.follow_up_status === "CONTROL_PROGRAMADO" ? "Control programado" : "Continuidad de atención",
          status: item.follow_up_status,
        })),
    };
  }
}
