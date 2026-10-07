import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClinicSettings } from "./ClinicSettings";

const context = {
  organization: { id: "clinic-1", name: "Clínica Demo", countryCode: "NI", timezone: "America/Managua", brandTheme: "retina" as const, logoPath: null },
  role: "clinic_admin" as const,
};

describe("configuración de clínica", () => {
  it("guarda una paleta por organización", async () => {
    const onSaveBranding = vi.fn().mockResolvedValue(undefined);
    render(<ClinicSettings context={context} userEmail="admin@example.test" onRegisterClinic={vi.fn()} onSaveBranding={onSaveBranding} />);
    fireEvent.click(screen.getByRole("radio", { name: "Océano" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar identidad visual" }));
    await waitFor(() => expect(onSaveBranding).toHaveBeenCalledWith("ocean", null));
    expect(screen.getByText("Identidad visual guardada para esta clínica.")).toBeInTheDocument();
  });

  it("registra una clínica con nombre validado", async () => {
    const onRegisterClinic = vi.fn().mockResolvedValue(undefined);
    render(<ClinicSettings context={context} userEmail="admin@example.test" onRegisterClinic={onRegisterClinic} onSaveBranding={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre de la clínica" }), { target: { value: " Clínica Nueva " } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar clínica" }));
    await waitFor(() => expect(onRegisterClinic).toHaveBeenCalledWith("Clínica Nueva"));
  });
});
