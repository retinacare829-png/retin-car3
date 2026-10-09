import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationSnapshot } from "../domain/notifications";
import { NotificationService } from "../services/notificationService";
import { useNotifications } from "./useNotifications";

vi.mock("../lib/supabase", () => ({ supabase: {} }));

const snapshot: NotificationSnapshot = {
  today: "2026-10-09", count: 1, followUpCount: 1, reportCount: 0,
  items: [{ id: "follow-up:a", title: "Seguimiento para hoy", detail: "09/10/2026", kind: "follow_up_due", urgent: false, destination: "workflow" }],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
async function settle() { await act(async () => { await Promise.resolve(); }); }

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("useNotifications", () => {
  it("discards stale organization results and clears the previous count immediately", async () => {
    const first = deferred<NotificationSnapshot>();
    const second = deferred<NotificationSnapshot>();
    const get = vi.spyOn(NotificationService.prototype, "getNotifications").mockResolvedValue(snapshot).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ org }) => useNotifications(org), { initialProps: { org: "org-a" } });
    rerender({ org: "org-b" });
    expect(get.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(result.current.count).toBeNull();
    await act(async () => { second.resolve({ ...snapshot, count: 2 }); await second.promise; });
    expect(result.current.count).toBe(2);
    await act(async () => { first.resolve(snapshot); await first.promise; });
    expect(result.current.count).toBe(2);
    rerender({ org: "org-c" });
    expect(result.current.data).toBeNull();
  });

  it("does not surface a previous organization's error after the active organization succeeds", async () => {
    const old = deferred<NotificationSnapshot>();
    vi.spyOn(NotificationService.prototype, "getNotifications").mockReturnValueOnce(old.promise).mockResolvedValue(snapshot);
    const { result, rerender } = renderHook(({ org }) => useNotifications(org), { initialProps: { org: "org-a" } });
    rerender({ org: "org-b" });
    await settle();
    await act(async () => { old.reject(new Error("private server details")); await Promise.resolve(); });
    expect(result.current.count).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it("invalidates on user/role changes and when there is no active organization", async () => {
    const get = vi.spyOn(NotificationService.prototype, "getNotifications").mockResolvedValue(snapshot);
    const initialProps: { org: string | undefined; user: string; reports: boolean } = { org: "org-a", user: "user-a", reports: true };
    const { result, rerender } = renderHook(({ org, user, reports }) => useNotifications(org, { scopeKey: user, includeReports: reports }), { initialProps });
    await settle();
    rerender({ org: "org-a", user: "user-b", reports: false });
    expect(result.current.count).toBeNull();
    await settle();
    expect(get).toHaveBeenLastCalledWith("org-a", expect.objectContaining({ includeReports: false }));
    rerender({ org: undefined, user: "user-b", reports: false });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("distinguishes a failed refresh from a verified empty result, sanitizes errors, and retries", async () => {
    const log = vi.spyOn(console, "error");
    const persist = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(NotificationService.prototype, "getNotifications").mockResolvedValueOnce(snapshot)
      .mockRejectedValueOnce(new Error("Sensitive patient details"))
      .mockResolvedValueOnce({ ...snapshot, items: [], count: 0, followUpCount: 0 });
    const { result } = renderHook(() => useNotifications("org-a"));
    await settle();
    expect(result.current.count).toBe(1);
    act(() => result.current.refresh());
    await settle();
    expect(result.current.error).toContain("No se pudieron cargar");
    expect(result.current.error).not.toContain("Sensitive");
    expect(result.current.count).toBeNull();
    expect(result.current.data).toBeNull();
    act(() => result.current.refresh());
    await settle();
    expect(result.current.count).toBe(0);
    expect(result.current.error).toBeNull();
    expect(log).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("refreshes on opening and focus, deduplicating overlapping requests", async () => {
    const pending = deferred<NotificationSnapshot>();
    const get = vi.spyOn(NotificationService.prototype, "getNotifications").mockResolvedValueOnce(snapshot).mockReturnValueOnce(pending.promise).mockResolvedValue(snapshot);
    const { rerender } = renderHook(({ open }) => useNotifications("org-a", { open }), { initialProps: { open: false } });
    await settle();
    rerender({ open: true });
    act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
    expect(get).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve(snapshot); await pending.promise; });
    act(() => { window.dispatchEvent(new Event("focus")); });
    await settle();
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("polls no faster than 60 seconds, skips hidden pages, and cleans up", async () => {
    const get = vi.spyOn(NotificationService.prototype, "getNotifications").mockResolvedValue(snapshot);
    const { unmount } = renderHook(() => useNotifications("org-a"));
    await settle();
    await act(() => vi.advanceTimersByTimeAsync(59_999));
    expect(get).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(get).toHaveBeenCalledTimes(2);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(get).toHaveBeenCalledTimes(2);
    unmount();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("times out a hung request and ignores its late response after a successful retry", async () => {
    const old = deferred<NotificationSnapshot>();
    const get = vi.spyOn(NotificationService.prototype, "getNotifications").mockReturnValueOnce(old.promise).mockResolvedValue({ ...snapshot, count: 2 });
    const { result } = renderHook(() => useNotifications("org-a"));
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    expect(get.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(result.current.error).toContain("No se pudieron cargar");
    expect(result.current.loading).toBe(false);
    act(() => result.current.refresh());
    await settle();
    await act(async () => { old.resolve(snapshot); await old.promise; });
    expect(result.current.count).toBe(2);
  });

  it("drops yesterday's count at Managua midnight while refreshing", async () => {
    vi.setSystemTime(new Date("2026-10-10T05:59:59Z"));
    const next = deferred<NotificationSnapshot>();
    vi.spyOn(NotificationService.prototype, "getNotifications").mockResolvedValueOnce(snapshot).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(() => useNotifications("org-a"));
    await settle();
    expect(result.current.count).toBe(1);
    vi.setSystemTime(new Date("2026-10-10T06:00:00Z"));
    rerender();
    expect(result.current.count).toBeNull();
    act(() => result.current.refresh());
    await act(async () => { next.resolve({ ...snapshot, today: "2026-10-10", count: 0, items: [], followUpCount: 0 }); await next.promise; });
    expect(result.current.count).toBe(0);
  });
});
