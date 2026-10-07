import { render, screen } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { PatientManagement } from "./PatientManagement";

vi.mock("../hooks/usePatients", () => ({
  usePatients: () => ({ patients: [], loading: false, saving: false, error: null, previewCodes: null,
    canWritePatients: false, reload: vi.fn(), createPatient: vi.fn(), updatePatient: vi.fn(), archivePatient: vi.fn(), restorePatient: vi.fn() }),
}));

describe("Pacientes para profesional", () => {
  it("permite consultar sin mostrar controles de alta", () => {
    render(<PatientManagement organizationId="org-demo" role="authorized_professional" user={{ id: "professional-demo" } as User} />);
    expect(screen.getByRole("table", { name: "Pacientes registrados" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Buscar paciente por nombre o identificador" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo paciente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Registrar paciente" })).not.toBeInTheDocument();
  });
});
