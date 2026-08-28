import type { LucideIcon } from "lucide-react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

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

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "info" | "progress" | "attention" | "complete" }) {
  return <span className={`status-badge status-${tone}`}><span aria-hidden="true" />{label}</span>;
}

export function getStatusTone(status: string): "neutral" | "info" | "progress" | "attention" | "complete" {
  if (status.includes("CERRADO") || status.includes("COMPLETAD") || status === "REVISADO") return "complete";
  if (status.includes("RECAPTURA") || status.includes("SEGUIMIENTO_REQUERIDO") || status === "INADECUADA") return "attention";
  if (status.includes("REVISION") || status.includes("PROCESO")) return "progress";
  if (status.includes("PENDIENTE") || status.includes("IMAGENES_COMPLETAS")) return "info";
  return "neutral";
}
