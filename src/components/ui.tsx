import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Inbox, Info, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { StatusTone } from "../domain/statusTone";
import { subscribeToToasts, type ToastDetail } from "../lib/appEvents";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty-state-card" role="status">
      <span className="empty-state-icon"><Icon aria-hidden="true" size={22} /></span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Cargando informacion" }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="skeleton-stack" aria-hidden="true"><span /><span /><span /></div>
      <span>{label}...</span>
      <span className="sr-only">Espere mientras finaliza la carga.</span>
    </div>
  );
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastDetail[]>([]);
  useEffect(() => subscribeToToasts((toast) => {
    setToasts((current) => [...current, toast].slice(-3));
    globalThis.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 4500);
  }), []);
  return <div className="toast-viewport" aria-live="polite" aria-atomic="true">{toasts.map((toast) => {
    const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? AlertCircle : Info;
    return <div className={`toast toast-${toast.tone}`} key={toast.id} role={toast.tone === "error" ? "alert" : "status"}><Icon aria-hidden="true" size={19} /><span>{toast.message}</span><button aria-label="Cerrar mensaje" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} type="button"><X size={16} /></button></div>;
  })}</div>;
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="notice notice-error" role="alert">
      <AlertCircle aria-hidden="true" size={20} />
      <div><strong>No pudimos completar la solicitud</strong><p>{message}</p></div>
      {onRetry ? <button className="ghost-button" onClick={onRetry} type="button">Reintentar</button> : null}
    </div>
  );
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <span className={`status-badge status-${tone}`}><span aria-hidden="true" />{label}</span>;
}
