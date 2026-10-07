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
  phone: "88880000",
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

function renderForm(patient: Patient | null, onSubmit = vi.fn().mockResolvedValue(undefined), previewCodes?: { internalIdentifier: string; recordCode: string; provisional: true }) {
  render(<PatientForm disabled={false} onCancel={vi.fn()} onSubmit={onSubmit} patient={patient} previewCodes={previewCodes} />);
  return onSubmit;
}

describe("PatientForm", () => {
  it("muestra códigos provisionales sin convertirlos en campos editables", () => {
    renderForm(null, undefined, { internalIdentifier: "001", recordCode: "001", provisional: true });

    expect(screen.getByText(/Vista previa provisional: identificador 001 · primer expediente 001/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("001")).not.toBeInTheDocument();
  });

  it("no solicita códigos al registrar y orienta a buscar una ficha existente", async () => {
    const onSubmit = renderForm(null);

    expect(screen.queryByLabelText("Identificador interno")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Expediente de esta visita")).not.toBeInTheDocument();
    expect(screen.getByText(/se asigna al guardar/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Mariana" } });
    fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "López" } });
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), { target: { value: "1980-05-12" } });
    fireEvent.click(screen.getByRole("button", { name: "No tengo teléfono" }));
    expect(screen.getByLabelText("Teléfono")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Sin teléfono");
    fireEvent.click(screen.getByRole("button", { name: "Registrar paciente" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const submitted = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(submitted).not.toHaveProperty("internalIdentifier");
    expect(submitted).not.toHaveProperty("medicalRecordCode");
    expect(submitted).toHaveProperty("phone", "00000000");
  });

  it("rechaza letras y longitudes inválidas del teléfono con mensajes específicos", () => {
    renderForm(null);
    const phone = screen.getByLabelText("Teléfono");

    fireEvent.change(phone, { target: { value: "8888ABCD" } });
    expect(phone).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("solo puede contener dígitos");

    fireEvent.change(phone, { target: { value: "8888888" } });
    expect(phone).toHaveValue("8888888");
    expect(screen.getByRole("alert")).toHaveTextContent("exactamente 8 dígitos");
  });

  it("precarga solamente el identificador interno como solo lectura", () => {
    renderForm(basePatient);

    expect(screen.getByLabelText("Identificador interno")).toHaveValue("RC-001");
    expect(screen.getByLabelText("Identificador interno")).toHaveAttribute("readonly");
    expect(screen.queryByLabelText("Expediente de esta visita")).not.toBeInTheDocument();
    expect(screen.getByText("El identificador interno es fijo por paciente. El expediente se genera y se muestra en cada screening.")).toBeInTheDocument();
  });

  it("conserva un teléfono histórico al editar otros datos", async () => {
    const onSubmit = renderForm({ ...basePatient, phone: "8888-0000" });

    expect(screen.getByText(/teléfono histórico se conservará/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0]).toHaveProperty("phone", "8888-0000");
  });

  it("conserva el formulario y muestra orientación si el backend rechaza un código duplicado", async () => {
    const onSubmit = vi.fn().mockRejectedValue({ code: "23505", message: "duplicate key value violates unique constraint" });
    renderForm(null, onSubmit);

    fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Mariana" } });
    fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "López" } });
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), { target: { value: "1980-05-12" } });
    fireEvent.click(screen.getByRole("button", { name: "No tengo teléfono" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar paciente" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("no se fusionan fichas automáticamente"));
    expect(screen.getByLabelText("Nombres")).toHaveValue("Mariana");
    expect(screen.getByLabelText("Apellidos")).toHaveValue("López");
  });
});
