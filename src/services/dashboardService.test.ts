import { describe, expect, it } from "vitest";
import type { TypedSupabaseClient } from "../lib/supabase";
import { DashboardService } from "./dashboardService";

describe("DashboardService", () => {
  it("muestra seguimientos fechados con paciente y prioridad, sin incluir decisiones sin cita", async () => {
    const rows: Record<string, unknown[]> = {
      patients: [{ id: "patient-1", first_names: "Mariana", last_names: "López", created_at: "2026-10-01T12:00:00Z" }],
      screenings: [], professional_reviews: [], patient_timeline_events: [],
      follow_ups: [
        { id: "follow-1", patient_id: "patient-1", follow_up_type: "CONTROL_PROGRAMADO", follow_up_status: "CONTROL_PROGRAMADO", urgency: "urgent", due_date: "2026-10-08", created_at: "2026-10-01T12:00:00Z" },
        { id: "follow-2", patient_id: "patient-1", follow_up_type: "CONTROL_PROGRAMADO", follow_up_status: "SIN_SEGUIMIENTO", urgency: "normal", due_date: "2026-10-09", created_at: "2026-10-01T12:00:00Z" },
      ],
    };
    const client = { from(table: string) {
      const query = {
        select: () => query, eq: () => query, is: () => query, order: () => query, limit: () => query,
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve),
      };
      return query;
    } } as unknown as TypedSupabaseClient;
    const data = await new DashboardService(client).getDashboard("clinic-1", new Date("2026-10-08T12:00:00"));
    expect(data.today.scheduledFollowUps).toBe(1);
    expect(data.appointments).toEqual([{ id: "appointment-follow-1", date: "2026-10-08", title: "Control programado", detail: "Mariana López", status: "CONTROL_PROGRAMADO", urgency: "urgent" }]);
  });
});
