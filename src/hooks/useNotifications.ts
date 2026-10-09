import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notificationToday, type NotificationSnapshot } from "../domain/notifications";
import { supabase } from "../lib/supabase";
import { NotificationService } from "../services/notificationService";

const REFRESH_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const loadError = "No se pudieron cargar las notificaciones. Intentá nuevamente.";

interface NotificationState {
  scope: string;
  data: NotificationSnapshot | null;
  loading: boolean;
  error: string | null;
}

interface UseNotificationsOptions {
  open?: boolean;
  includeReports?: boolean;
  /** User/session identity: changing it invalidates even an unchanged organization. */
  scopeKey?: string;
}

export function useNotifications(organizationId: string | undefined, { open = false, includeReports = true, scopeKey = "" }: UseNotificationsOptions = {}) {
  const service = useMemo(() => supabase ? new NotificationService(supabase) : null, []);
  const scope = JSON.stringify([organizationId, scopeKey, includeReports]);
  const [state, setState] = useState<NotificationState>({ scope, data: null, loading: !!organizationId, error: null });
  const refreshRef = useRef<() => void>(() => undefined);
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    let active = true;
    let inFlight: AbortController | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      if (!active || inFlight || !organizationId) return;
      if (!service) {
        setState({ scope, data: null, loading: false, error: "No se pudieron cargar las notificaciones: conexión no disponible." });
        return;
      }
      const controller = new AbortController();
      inFlight = controller;
      setState((current) => ({ scope, data: current.scope === scope && current.data?.today === notificationToday() ? current.data : null, loading: true, error: null }));
      const requestTimeout = setTimeout(() => {
        controller.abort();
        if (active && inFlight === controller) {
          inFlight = null;
          setState({ scope, data: null, loading: false, error: loadError });
        }
      }, REQUEST_TIMEOUT_MS);
      timeout = requestTimeout;
      void service.getNotifications(organizationId, { includeReports, signal: controller.signal }).then((data) => {
        if (active && !controller.signal.aborted) setState({ scope, data, loading: false, error: null });
      }).catch(() => {
        if (active && !controller.signal.aborted) setState({ scope, data: null, loading: false, error: loadError });
      }).finally(() => {
        clearTimeout(requestTimeout);
        if (inFlight === controller) inFlight = null;
      });
    };
    refreshRef.current = load;
    setState({ scope, data: null, loading: !!organizationId, error: null });
    load();
    const refreshVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const interval = setInterval(refreshVisible, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      inFlight?.abort();
      clearTimeout(timeout);
      clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      refreshRef.current = () => undefined;
    };
  }, [organizationId, scope, includeReports, service]);

  useEffect(() => { if (open) refresh(); }, [open, scope, refresh]);

  // Mask the previous scope during render, before the effect resets it.
  const current = state.scope === scope ? state : { scope, data: null, loading: !!organizationId, error: null };
  const data = current.data?.today === notificationToday() ? current.data : null;
  return { data, count: data?.count ?? null, loading: current.loading, error: current.error, refresh };
}
