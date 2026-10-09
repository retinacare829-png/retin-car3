import {
  activeFollowUpStatuses, buildClinicNotifications, NOTIFICATION_SOURCE_LIMIT, notificationToday,
  type NotificationSnapshot,
} from "../domain/notifications";
import type { TypedSupabaseClient } from "../lib/supabase";

export interface NotificationQueryOptions {
  now?: Date;
  includeReports?: boolean;
  signal?: AbortSignal;
}

export class NotificationService {
  constructor(private readonly client: TypedSupabaseClient) {}

  async getNotifications(organizationId: string, { now = new Date(), includeReports = true, signal }: NotificationQueryOptions = {}): Promise<NotificationSnapshot> {
    if (!organizationId.trim()) throw new Error("Se requiere una organización activa.");
    const today = notificationToday(now);
    // Exact counts share the same filters as the bounded lists; no patient records or report contents are fetched.
    let followUps = this.client.from("follow_ups")
      .select("id, organization_id, follow_up_type, follow_up_status, urgency, due_date, completed_at, deleted_at", { count: "exact" })
      .eq("organization_id", organizationId).eq("due_date", today)
      .is("deleted_at", null).is("completed_at", null).in("follow_up_status", [...activeFollowUpStatuses])
      .order("urgency", { ascending: false }).order("id", { ascending: true }).limit(NOTIFICATION_SOURCE_LIMIT);
    if (signal) followUps = followUps.abortSignal(signal);
    const getReports = async () => {
      if (!includeReports) return { data: [], count: 0, error: null };
      let reports = this.client.from("screenings")
        .select("id, organization_id, patient_published_at, deleted_at", { count: "exact" })
        .eq("organization_id", organizationId).is("deleted_at", null).not("patient_published_at", "is", null)
        .lte("patient_published_at", now.toISOString())
        .order("patient_published_at", { ascending: false }).order("id", { ascending: true }).limit(NOTIFICATION_SOURCE_LIMIT);
      if (signal) reports = reports.abortSignal(signal);
      return await reports;
    };
    const [due, published] = await Promise.all([followUps, getReports()]);
    // Do not expose raw server errors, which can contain sensitive record details.
    if (due.error || published.error || !due.data || !published.data || due.count === null || published.count === null) {
      throw new Error("No se pudieron cargar las notificaciones.");
    }
    return {
      today, items: buildClinicNotifications(organizationId, due.data, published.data, now),
      count: due.count + published.count, followUpCount: due.count, reportCount: published.count,
    };
  }
}
