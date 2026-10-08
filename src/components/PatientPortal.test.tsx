import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { PatientPortalSnapshot } from "../domain/patientPortal";
import { PatientPortal } from "./PatientPortal";

const snapshot: PatientPortalSnapshot = {
  contractVersion: 1,
  profile: {
    patientId: "patient-1",
    organizationId: "org-1",
    organizationName: "Clínica RetinaCare",
    displayName: "María",
    firstNames: "María",
    lastNames: "Ejemplo",
    dateOfBirth: "1980-04-03",
    phone: "88888888",
    email: "maria@example.test",
  },
  screenings: [{
    id: "screening-1",
    recordCode: "RC-0001",
    createdAt: "2026-10-08T12:00:00Z",
    status: "REVISADO",
    statusLabel: "Revisado",
    reportPublished: true,
  }, {
    id: "screening-2",
    recordCode: "RC-0002",
    createdAt: "2026-10-07T12:00:00Z",
    status: "PENDIENTE_REVISION",
    statusLabel: "Pendiente de revisión",
    reportPublished: false,
  }],
  reports: [{
    id: "report-1",
    screeningId: "screening-1",
    recordCode: "RC-0001",
    title: "Informe de screening",
    summary: "La clínica ha compartido este resumen contigo.",
    nextStep: "Control según indicación de la clínica",
    publishedAt: "2026-10-08T13:00:00Z",
    publishedBy: "Profesional autorizado",
  }],
};

const user = { id: "user-1", email: "maria@example.test" } as User;

describe("PatientPortal", () => {
  it("muestra un espacio paciente separado y no expone navegación clínica", async () => {
    const getSnapshot = vi.fn().mockResolvedValue(snapshot);
    render(<PatientPortal adapter={{ getSnapshot }} onSignOut={vi.fn()} user={user} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Hola, María" })).toBeInTheDocument());
    expect(screen.getByRole("navigation", { name: "Navegación del portal paciente" })).toBeInTheDocument();
    expect(screen.queryByText("Workflow Clínico")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear screening/i })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("No ofrece diagnósticos ni sustituye la orientación de un profesional.");
    expect(getSnapshot).toHaveBeenCalledWith();
  });

  it("diferencia estado de screening e informe profesional publicado", async () => {
    render(<PatientPortal adapter={{ getSnapshot: vi.fn().mockResolvedValue(snapshot) }} onSignOut={vi.fn()} user={user} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Hola, María" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Mis screenings" }));
    expect(screen.getByRole("heading", { name: "Mis screenings" })).toBeInTheDocument();
    expect(screen.getByText("Pendiente de revisión")).toBeInTheDocument();
    expect(screen.getByText("Aún no publicado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mis informes" }));
    expect(screen.getByRole("heading", { name: "Mis informes" })).toBeInTheDocument();
    expect(screen.getByText("Informe de screening")).toBeInTheDocument();
    expect(screen.getByText("Solo aparecen informes publicados después de la aprobación explícita de un profesional.")).toBeInTheDocument();
  });

  it("ofrece estado de error y reintento sin mostrar datos parciales", async () => {
    const getSnapshot = vi.fn().mockRejectedValue(new Error("Servicio no disponible"));
    render(<PatientPortal adapter={{ getSnapshot }} onSignOut={vi.fn()} user={user} />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Servicio no disponible"));
    expect(screen.queryByText("Informe de screening")).not.toBeInTheDocument();
    getSnapshot.mockResolvedValue(snapshot);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Hola, María" })).toBeInTheDocument());
    expect(getSnapshot).toHaveBeenCalledTimes(2);
  });
});
