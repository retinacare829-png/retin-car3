import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../lib/supabase";
import { NotificationService } from "../services/notificationService";
import {
  activeFollowUpStatuses, buildClinicNotifications, NOTIFICATION_SOURCE_LIMIT, notificationToday,
  type NotificationFollowUp, type NotificationReport,
} from "./notifications";

const now = new Date("2026-10-09T06:00:00Z");
const followUp: NotificationFollowUp = {
  id: "follow-1", organization_id: "org-1", follow_up_type: "CONTROL_PROGRAMADO", follow_up_status: "CONTROL_PROGRAMADO",
  urgency: "normal", due_date: "2026-10-09", completed_at: null, deleted_at: null,
};
const report: NotificationReport = { id: "report-1", organization_id: "org-1", patient_published_at: "2026-10-09T05:59:00Z", deleted_at: null };

describe("clinic notification dates and eligibility", () => {
  it.each([
    ["2026-10-09T05:59:59.999Z", "2026-10-08"], ["2026-10-09T06:00:00Z", "2026-10-09"],
    ["2026-10-10T05:59:59.999Z", "2026-10-09"], ["2026-10-10T06:00:00Z", "2026-10-10"],
    ["2027-01-01T05:59:59Z", "2026-12-31"], ["2027-01-01T06:00:00Z", "2027-01-01"],
    ["2028-03-01T05:59:59Z", "2028-02-29"],
  ])("uses Managua calendar day at %s", (instant, expected) => {
    expect(notificationToday(new Date(instant))).toBe(expected);
  });

  it("compares due_date directly and switches eligibility exactly at local midnight", () => {
    expect(buildClinicNotifications("org-1", [followUp], [], new Date("2026-10-09T05:59:59.999Z"))).toEqual([]);
    expect(buildClinicNotifications("org-1", [followUp], [], now)).toMatchObject([{ detail: "Control programado · 09/10/2026" }]);
    expect(buildClinicNotifications("org-1", [followUp], [], new Date("2026-10-10T06:00:00Z"))).toEqual([]);
  });

  it("excludes completed, canceled, deleted, other-org and undated follow-ups", () => {
    const excluded: Partial<NotificationFollowUp>[] = [
      { follow_up_status: "SEGUIMIENTO_COMPLETADO" }, { follow_up_status: "CANCELADO" }, { follow_up_status: "SIN_SEGUIMIENTO" },
      { completed_at: now.toISOString() }, { deleted_at: now.toISOString() }, { organization_id: "org-2" },
      { due_date: null }, { due_date: "2026-10-08" }, { due_date: "2026-10-10" },
    ];
    expect(buildClinicNotifications("org-1", excluded.map((row) => ({ ...followUp, ...row })), [], now)).toEqual([]);
    expect(buildClinicNotifications("org-1", activeFollowUpStatuses.map((status) => ({ ...followUp, id: status, follow_up_status: status })), [], now)).toHaveLength(3);
  });

  it("orders urgent follow-ups first and published reports newest first, in Managua time", () => {
    const items = buildClinicNotifications("org-1", [followUp, { ...followUp, id: "urgent", urgency: "urgent" }], [
      { ...report, id: "older", patient_published_at: "2026-10-08T04:00:00Z" }, report,
      { ...report, id: "unpublished", patient_published_at: null }, { ...report, id: "future", patient_published_at: "2026-10-10T06:00:00Z" },
      { ...report, id: "deleted", deleted_at: now.toISOString() }, { ...report, id: "other", organization_id: "org-2" },
      { ...report, id: "invalid", patient_published_at: "invalid" },
    ], now);
    expect(items.map((item) => item.id)).toEqual(["follow-up:urgent", "follow-up:follow-1", "report:report-1", "report:older"]);
    expect(items[0]).toMatchObject({ urgent: true, destination: "workflow" });
    expect(items[2]?.destination).toBe("reports");
    expect(items[2]?.detail).toContain("08/10/2026");
  });
});

function queryClient(failTable?: string, missingCount = false) {
  const urls: URL[] = [];
  const fetch = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    urls.push(url);
    const table = url.pathname.split("/").at(-1);
    if (failTable === table) return Promise.resolve(new Response(JSON.stringify({ message: "Sensitive server details", code: "42501" }), { status: 403 }));
    return Promise.resolve(new Response(JSON.stringify(table === "follow_ups" ? [followUp] : [report]), {
      headers: { "content-type": "application/json", ...(missingCount ? {} : { "content-range": table === "follow_ups" ? "0-0/41" : "0-0/25" }) },
    }));
  });
  const client = createClient<Database>("https://notifications.example.test", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
  });
  return { client, urls, fetch };
}

describe("NotificationService queries", () => {
  it("uses scoped, filtered, bounded queries with exact counts exceeding the returned list", async () => {
    const { client, urls, fetch } = queryClient();
    const result = await new NotificationService(client).getNotifications("org-1", { now });
    expect(result).toMatchObject({ today: "2026-10-09", count: 66, followUpCount: 41, reportCount: 25 });
    expect(result.items).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const url of urls) {
      expect(url.searchParams.get("organization_id")).toBe("eq.org-1");
      expect(url.searchParams.get("deleted_at")).toBe("is.null");
      expect(url.searchParams.get("limit")).toBe(String(NOTIFICATION_SOURCE_LIMIT));
      expect(url.searchParams.get("select")).not.toMatch(/\*|notes|first_names|patient_report_summary|patient_id/);
    }
    const followUrl = urls.find((url) => url.pathname.endsWith("follow_ups"))!;
    expect(followUrl.searchParams.get("due_date")).toBe("eq.2026-10-09");
    expect(followUrl.searchParams.get("completed_at")).toBe("is.null");
    expect(followUrl.searchParams.get("follow_up_status")).toBe(`in.(${activeFollowUpStatuses.join(",")})`);
    expect(followUrl.searchParams.get("order")).toBe("urgency.desc,id.asc");
    const reportUrl = urls.find((url) => url.pathname.endsWith("screenings"))!;
    expect(reportUrl.searchParams.getAll("patient_published_at")).toEqual(["not.is.null", `lte.${now.toISOString()}`]);
  });

  it("skips report queries when the role cannot navigate to reports", async () => {
    const { client, fetch } = queryClient();
    const result = await new NotificationService(client).getNotifications("org-1", { now, includeReports: false });
    expect(result.count).toBe(41);
    expect(result.reportCount).toBe(0);
    expect(fetch).toHaveBeenCalledOnce();
    expect(result.items.every((item) => item.destination === "workflow")).toBe(true);
  });

  it.each(["follow_ups", "screenings"])("rejects %s errors instead of reporting empty or partial success", async (table) => {
    const { client } = queryClient(table);
    await expect(new NotificationService(client).getNotifications("org-1", { now })).rejects.toThrow("No se pudieron cargar las notificaciones.");
  });

  it("rejects missing counts and missing organization without querying an unscoped table", async () => {
    const { client, fetch } = queryClient(undefined, true);
    const service = new NotificationService(client);
    await expect(service.getNotifications(" ")).rejects.toThrow("organización activa");
    expect(fetch).not.toHaveBeenCalled();
    await expect(service.getNotifications("org-1", { now })).rejects.toThrow("No se pudieron cargar");
  });
});
