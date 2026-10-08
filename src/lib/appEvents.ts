export type DataArea = "patients" | "screenings" | "workflow" | "dashboard" | "reports";

const DATA_CHANGED_EVENT = "retinacare:data-changed";
const TOAST_EVENT = "retinacare:toast";

export interface ToastDetail {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
}

export function invalidateData(...areas: DataArea[]) {
  globalThis.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: { areas } }));
}

export function subscribeToDataInvalidation(area: DataArea, listener: () => void) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ areas: DataArea[] }>).detail;
    if (detail?.areas.includes(area)) listener();
  };
  globalThis.addEventListener(DATA_CHANGED_EVENT, handler);
  return () => globalThis.removeEventListener(DATA_CHANGED_EVENT, handler);
}

export function notify(message: string, tone: ToastDetail["tone"] = "success") {
  globalThis.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, {
    detail: { id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`, message, tone },
  }));
}

export function subscribeToToasts(listener: (toast: ToastDetail) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<ToastDetail>).detail);
  globalThis.addEventListener(TOAST_EVENT, handler);
  return () => globalThis.removeEventListener(TOAST_EVENT, handler);
}

export function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("permission") || message.includes("policy") || message.includes("rol no permite") || message.includes("42501")) return "No tiene permisos suficientes para realizar esta acción.";
  if (message.includes("timeout") || message.includes("timed out") || message.includes("abort")) return "La operación tardó demasiado. Intente nuevamente.";
  if (message.includes("network") || message.includes("fetch") || message.includes("conex")) return "Error de conexión. Verifique su red e intente nuevamente.";
  return fallback;
}
