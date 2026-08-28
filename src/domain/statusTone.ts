export type StatusTone = "neutral" | "info" | "progress" | "attention" | "complete";

export function getStatusTone(status: string): StatusTone {
  if (status.includes("CERRADO") || status.includes("COMPLETAD") || status === "REVISADO") return "complete";
  if (status.includes("RECAPTURA") || status.includes("SEGUIMIENTO_REQUERIDO") || status === "INADECUADA") return "attention";
  if (status.includes("REVISION") || status.includes("PROCESO")) return "progress";
  if (status.includes("PENDIENTE") || status.includes("IMAGENES_COMPLETAS")) return "info";
  return "neutral";
}
