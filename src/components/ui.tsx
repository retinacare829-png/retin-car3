import type { LucideIcon } from "lucide-react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { StatusTone } from "../domain/statusTone";

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
      <LoaderCircle className="loading-spinner" aria-hidden="true" size={20} />
      <span>{label}...</span>
      <span className="sr-only">Espere mientras finaliza la carga.</span>
    </div>
  );
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
