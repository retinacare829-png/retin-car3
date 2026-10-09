import { useEffect, useId, useRef, useState } from "react";
import { CalendarClock, FileCheck2, RefreshCw, X } from "lucide-react";
import type { ClinicNotification, NotificationDestination } from "../domain/notifications";
import { useNotifications } from "../hooks/useNotifications";
import { AnimatedNotificationBell } from "./AnimatedNotificationBell";
import "./NotificationCenter.css";

export interface NotificationCenterProps {
  items: readonly ClinicNotification[];
  /** Null means unknown/unavailable, not an empty inbox. */
  count: number | null;
  loading: boolean;
  error: string | null;
  scopeKey: string;
  onRefresh: () => void;
  onNavigate: (destination: NotificationDestination, item?: ClinicNotification) => void;
  disabled?: boolean;
  contextLabel?: string;
  summary?: string;
  actions?: readonly { label: string; destination: NotificationDestination }[];
}

export interface ClinicNotificationCenterProps {
  organizationId?: string;
  userId: string;
  canViewReports: boolean;
  onNavigate: (destination: NotificationDestination) => void;
}

export function ClinicNotificationCenter({ organizationId, userId, canViewReports, onNavigate }: ClinicNotificationCenterProps) {
  const scope = JSON.stringify([organizationId, userId, canViewReports]);
  const { data, count, loading, error, refresh } = useNotifications(organizationId, { includeReports: canViewReports, scopeKey: userId });
  return <NotificationCenter scopeKey={scope} items={data?.items ?? []} count={count} loading={loading} error={error}
    disabled={!organizationId} onRefresh={refresh} onNavigate={onNavigate}
    contextLabel={`Seguimientos de hoy${canViewReports ? " y reportes publicados" : ""} · Managua`}
    summary={data ? `${data.followUpCount} seguimientos para hoy${canViewReports ? ` · ${data.reportCount} reportes publicados` : ""}` : undefined}
    actions={[{ label: "Ver seguimientos", destination: "workflow" }, ...(canViewReports ? [{ label: "Ver reportes", destination: "reports" as const }] : [])]} />;
}

/** In-memory presentation shared with the patient portal; callers supply only authorized items. */
export function NotificationCenter({ items, count, loading, error, scopeKey: scope, onRefresh, onNavigate, disabled = false, contextLabel, summary, actions = [] }: NotificationCenterProps) {
  const [openScope, setOpenScope] = useState<string | null>(null);
  const open = !disabled && openScope === scope;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const summaryId = useId();

  useEffect(() => { setOpenScope(null); }, [scope, disabled]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenScope(null);
        triggerRef.current?.focus();
      }
    };
    const onOutside = (event: Event) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpenScope(null);
    };
    document.addEventListener("keydown", onEscape);
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("focusin", onOutside);
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("focusin", onOutside);
    };
  }, [open]);

  const close = () => { setOpenScope(null); triggerRef.current?.focus(); };
  const navigate = (destination: NotificationDestination, item?: ClinicNotification) => { close(); onNavigate(destination, item); };
  const show = () => { setOpenScope(scope); onRefresh(); };

  return <div className="clinic-notifications" ref={rootRef}>
    <AnimatedNotificationBell ref={triggerRef} className="clinic-notifications-trigger" count={count ?? 0} label="Notificaciones" announce={false}
      aria-label="Notificaciones" aria-describedby={summaryId} aria-haspopup="dialog" aria-controls={open ? panelId : undefined}
      aria-expanded={open} disabled={disabled} onClick={() => { if (open) setOpenScope(null); else show(); }}
      onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); if (!open) show(); else closeRef.current?.focus(); } }} />
    {error ? <span className="clinic-notifications-error-dot" aria-hidden="true">!</span> : null}
    <span id={summaryId} className="sr-only" role="status">{disabled ? "Notificaciones no disponibles." : error ? "Notificaciones no disponibles." : count === null ? "Cargando notificaciones." : `${count} notificaciones disponibles.`}</span>
    {open ? <section id={panelId} className="clinic-notifications-panel" role="dialog" aria-labelledby={titleId}>
      <header className="clinic-notifications-header">
        <h2 id={titleId}>Notificaciones</h2>
        <button ref={closeRef} type="button" aria-label="Cerrar notificaciones" onClick={close}><X size={18} aria-hidden="true" /></button>
      </header>
      {contextLabel ? <p className="clinic-notifications-context">{contextLabel}</p> : null}
      {error ? <div className="clinic-notifications-error"><p role="alert">{error}</p><button type="button" onClick={onRefresh}>Reintentar</button></div> : null}
      {loading ? <p role="status">{count !== null ? "Actualizando notificaciones…" : "Cargando notificaciones…"}</p> : null}
      {!error && count !== null ? <>
        {summary ? <p className="clinic-notifications-summary">{summary}</p> : null}
        {count === 0 ? <p role="status">No hay notificaciones disponibles.</p> : <ul className="clinic-notifications-list">
          {items.map((item) => <li key={item.id}>
            <button className="clinic-notifications-item" type="button" onClick={() => navigate(item.destination, item)}>
              {item.kind === "follow_up_due" ? <CalendarClock size={20} aria-hidden="true" /> : <FileCheck2 size={20} aria-hidden="true" />}
              <span><strong>{item.title}</strong><span className="clinic-notifications-detail">{item.detail}</span>
                {item.urgent ? <span className="clinic-notifications-urgent">Urgente</span> : null}
                <span className="clinic-notifications-action">{item.destination === "workflow" ? "Abrir workflow clínico" : "Abrir reportes"}</span>
              </span>
            </button>
          </li>)}
        </ul>}
        {count > items.length ? <p className="clinic-notifications-context">Mostrando {items.length} de {count}. Consultá todos en su sección.</p> : null}
      </> : null}
      <footer className="clinic-notifications-footer">
        {actions.map((action) => <button key={action.destination} type="button" onClick={() => navigate(action.destination)}>{action.label}</button>)}
        <button type="button" onClick={onRefresh} disabled={loading} aria-label="Actualizar notificaciones"><RefreshCw size={16} aria-hidden="true" /></button>
      </footer>
    </section> : null}
  </div>;
}
