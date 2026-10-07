import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClinicSettings } from "./ClinicSettings";

vi.mock("../domain/clinicBranding", async (importOriginal) => {
  const original = await importOriginal<typeof import("../domain/clinicBranding")>();
  return { ...original, paletteFromLogo: vi.fn().mockResolvedValue(original.clinicThemes.retina) };
});

const context = {
  organization: { id: "clinic-1", name: "Clínica Demo", countryCode: "NI", timezone: "America/Managua", brandTheme: "retina" as const, logoPath: null },
  role: "clinic_admin" as const,
};

describe("configuración de clínica", () => {
  it("solo guarda identidad visual después de seleccionar un logo", async () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test-logo") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const onSaveBranding = vi.fn().mockResolvedValue(undefined);
    render(<ClinicSettings context={context} userEmail="admin@example.test" onRegisterClinic={vi.fn()} onSaveBranding={onSaveBranding} />);
    const save = screen.getByRole("button", { name: "Guardar logo y aplicar colores" });
    expect(save).toBeDisabled();
    const file = new File(["logo"], "clinica.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/Logo de la clínica/), { target: { files: [file] } });
    fireEvent.click(save);
    await waitFor(() => expect(onSaveBranding).toHaveBeenCalledWith("retina", file));
    expect(screen.getByText("Logo guardado. Los colores se ajustaron automáticamente a tu clínica.")).toBeInTheDocument();
  });

  it("registra una clínica con nombre validado", async () => {
    const onRegisterClinic = vi.fn().mockResolvedValue(undefined);
    render(<ClinicSettings context={context} userEmail="admin@example.test" onRegisterClinic={onRegisterClinic} onSaveBranding={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre de la clínica" }), { target: { value: " Clínica Nueva " } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar clínica" }));
    await waitFor(() => expect(onRegisterClinic).toHaveBeenCalledWith("Clínica Nueva"));
  });
});
