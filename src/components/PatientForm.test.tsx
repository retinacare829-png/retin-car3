import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Patient } from "../domain/patient";
import { PatientForm } from "./PatientForm";

const basePatient: Patient = {
  id: "patient-1",
  organizationId: "org-demo",
  internalIdentifier: "RC-001",
  medicalRecordCode: "EXP-001",
  firstNames: "Mariana",
  lastNames: "López",
  dateOfBirth: "1980-05-12",
  sex: "female",
  phone: "8888-0000",
  diabetesDiagnosisDate: null,
  diabetesType: "type_2",
  notes: "Ficha demo",
  createdAt: "2026-01-01T12:00:00Z",
  updatedAt: "2026-01-01T12:00:00Z",
  createdBy: "user-1",
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
};

function renderForm(patient: Patient | null, onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(<PatientForm disabled={false} onCancel={vi.fn()} onSubmit={onSubmit} patient={patient} />);
  return onSubmit;
}

describe("PatientForm", () => {
  it("no solicita códigos al registrar y orienta a buscar una ficha existente", async () => {
    const onSubmit = renderForm(null);

    expect(screen.queryByLabelText("Identificador interno")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Expediente de esta visita")).not.toBeInTheDocument();
    expect(screen.getByText(/se asigna al guardar/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Mariana" } });
    fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "López" } });
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), { target: { value: "1980-05-12" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar paciente" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const submitted = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(submitted).not.toHaveProperty("internalIdentifier");
    expect(submitted).not.toHaveProperty("medicalRecordCode");
  });

  it("precarga solamente el identificador interno como solo lectura", () => {
    renderForm(basePatient);

    expect(screen.getByLabelText("Identificador interno")).toHaveValue("RC-001");
    expect(screen.getByLabelText("Identificador interno")).toHaveAttribute("readonly");
    expect(screen.queryByLabelText("Expediente de esta visita")).not.toBeInTheDocument();
    expect(screen.getByText("El identificador interno es fijo por paciente. El expediente se genera y se muestra en cada screening.")).toBeInTheDocument();
  });

  it("conserva el formulario y muestra orientación si el backend rechaza un código duplicado", async () => {
    const onSubmit = vi.fn().mockRejectedValue({ code: "23505", message: "duplicate key value violates unique constraint" });
    renderForm(null, onSubmit);

    fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Mariana" } });
    fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "López" } });
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), { target: { value: "1980-05-12" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar paciente" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("no se fusionan fichas automáticamente"));
    expect(screen.getByLabelText("Nombres")).toHaveValue("Mariana");
    expect(screen.getByLabelText("Apellidos")).toHaveValue("López");
  });
});
