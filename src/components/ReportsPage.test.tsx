import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReportsAdapter, ReportsSnapshot } from "../hooks/useReports";
import { ReportsPage } from "./ReportsPage";

const snapshot: ReportsSnapshot = {
  generatedAt: "2026-10-06T12:00:00Z",
  patientRows: [{ id: "patient-1", patientName: "López, Mariana", identifier: "RC-001", screenings: 2, lastActivityAt: "2026-10-05T12:00:00Z", lastStatusLabel: "Revisado", followUps: 1 }],
  screeningRows: [{ id: "screening-1", patientName: "López, Mariana", patientIdentifier: "RC-001", createdAt: "2026-10-05T12:00:00Z", statusLabel: "Revisado", qualityLabel: "Adecuada", reviewLabel: "Completada", followUpLabel: "Control programado", odAvailable: true, oiAvailable: true, referenceLabel: "No requerida" }],
  operationMetrics: [{ id: "pending", label: "Pendientes de revisión", value: 3, detail: "Requieren continuidad profesional." }],
};

const adapter: ReportsAdapter = { getSnapshot: vi.fn().mockResolvedValue(snapshot) };

describe("ReportsPage", () => {
  it("presenta disclaimer, filtros, vistas y carga datos desde el adaptador", async () => {
    render(<ReportsPage adapter={adapter} organizationId="org-demo" organizationName="Clínica Demo" role="authorized_professional" />);

    expect(screen.getByRole("heading", { name: "Actividad clínica trazable" })).toBeInTheDocument();
    expect(screen.getByText("Reporte profesional no diagnóstico")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar paciente o expediente")).toBeDisabled();

    await waitFor(() => expect(screen.getByText("López, Mariana")).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: /Por paciente/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Revisado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Por screening/i }));
    expect(screen.getByRole("heading", { name: "Estado de cada screening" })).toBeInTheDocument();
    expect(screen.getByText("Adecuada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle" }));
    expect(screen.getAllByText("Disponible")).toHaveLength(2);
    expect(screen.getByText("No requerida")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Operación" }));
    expect(screen.getByRole("heading", { name: "Indicadores de trabajo" })).toBeInTheDocument();
    expect(screen.getByText("Pendientes de revisión")).toBeInTheDocument();
  });

  it("permite imprimir una vista con datos", async () => {
    const print = vi.spyOn(globalThis, "print").mockImplementation(() => undefined);
    render(<ReportsPage adapter={adapter} organizationId="org-demo" organizationName="Clínica Demo" role="clinic_admin" />);
    await waitFor(() => expect(screen.getByText("López, Mariana")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Imprimir reporte/i }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it("expone estado seguro mientras espera el adaptador del backend", () => {
    render(<ReportsPage organizationId="org-demo" organizationName="Clínica Demo" role="clinic_admin" />);
    expect(screen.getByText("Conector de reportes pendiente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Imprimir reporte/i })).toBeDisabled();
  });
});
