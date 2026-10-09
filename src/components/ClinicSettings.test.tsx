import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClinicSettings } from "./ClinicSettings";

const logoPalette = vi.hoisted(() => ({ primary: "#183b89", dark: "#102557", soft: "#e5ecfa", sidebar: "#112440", accent: "#9ab5f2" }));
vi.mock("../domain/clinicBranding", async (importOriginal) => {
  const original = await importOriginal<typeof import("../domain/clinicBranding")>();
  return { ...original, paletteFromLogo: vi.fn().mockResolvedValue(logoPalette) };
});

const context = {
  organization: { id: "clinic-1", name: "Clínica Demo", countryCode: "NI", timezone: "America/Managua", brandTheme: "retina" as const, logoPath: null },
  role: "clinic_admin" as const,
};

function setupObjectUrls() {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test-logo") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
}

describe("configuración de clínica", () => {
  it("conserva el logo guardado en la vista previa sin volver a subirlo", () => {
    render(<ClinicSettings context={context} savedLogoPalette={null} savedLogoUrl="blob:logo-guardado" userEmail="admin@example.test" onRegisterClinic={vi.fn()} onSaveBranding={vi.fn()} />);
    const preview = screen.getByLabelText("Vista previa de la paleta seleccionada");
    expect(preview.querySelector('.clinic-preview-organization img')).toHaveAttribute("src", "blob:logo-guardado");
    expect(screen.getByRole("button", { name: "Guardar identidad visual" })).toBeDisabled();
  });
  it("permite subir logo sin cambiar los colores predeterminados", async () => {
    setupObjectUrls();
    const onSaveBranding = vi.fn().mockResolvedValue(undefined);
    render(<ClinicSettings context={context} savedLogoPalette={null} userEmail="admin@example.test" onRegisterClinic={vi.fn()} onSaveBranding={onSaveBranding} />);
    const save = screen.getByRole("button", { name: "Guardar identidad visual" });
    expect(save).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Colores RetinaCare/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Colores del logo/ })).toBeDisabled();
    expect(screen.getByText("#456e68")).toBeInTheDocument();
    const file = new File(["logo"], "clinica.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Seleccionar logo de la clínica"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("radio", { name: /Colores del logo/ })).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(onSaveBranding).toHaveBeenCalledWith("retina", file));
    expect(screen.getByRole("status")).toHaveTextContent(/conserva los colores RetinaCare/i);
  });

  it("acepta arrastrar un logo y elegir sus colores", async () => {
    setupObjectUrls();
    const onSaveBranding = vi.fn().mockResolvedValue(undefined);
    render(<ClinicSettings context={context} savedLogoPalette={null} userEmail="admin@example.test" onRegisterClinic={vi.fn()} onSaveBranding={onSaveBranding} />);
    const file = new File(["logo"], "logo.webp", { type: "image/webp" });
    const dropzone = screen.getByText("Arrastrá aquí la imagen desde tu computadora").closest(".clinic-folder-dropzone");
    expect(dropzone).not.toBeNull();
    fireEvent.drop(dropzone!, { dataTransfer: { types: ["Files"], files: [file] } });
    const logoRadio = await screen.findByRole("radio", { name: /Colores del logo/ });
    await waitFor(() => expect(logoRadio).toBeEnabled());
    fireEvent.click(logoRadio);
    expect(screen.getByText("#183b89")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar identidad visual" }));
    await waitFor(() => expect(onSaveBranding).toHaveBeenCalledWith("logo", file));
  });

  it("cambia una clínica con logo existente a la paleta RetinaCare sin resubir archivo", async () => {
    const onSaveBranding = vi.fn().mockResolvedValue(undefined);
    const existingContext = { ...context, organization: { ...context.organization, brandTheme: "logo" as const, logoPath: "clinic-1/logo" } };
    render(<ClinicSettings context={existingContext} savedLogoPalette={logoPalette} userEmail="admin@example.test" onRegisterClinic={vi.fn()} onSaveBranding={onSaveBranding} />);
    expect(screen.getByRole("radio", { name: /Colores del logo/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Colores RetinaCare/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar identidad visual" }));
    await waitFor(() => expect(onSaveBranding).toHaveBeenCalledWith("retina", null));
  });

  it("registra una clínica con nombre validado", async () => {
    const onRegisterClinic = vi.fn().mockResolvedValue(undefined);
    render(<ClinicSettings context={context} savedLogoPalette={null} userEmail="admin@example.test" onRegisterClinic={onRegisterClinic} onSaveBranding={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre de la clínica" }), { target: { value: " Clínica Nueva " } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar clínica" }));
    await waitFor(() => expect(onRegisterClinic).toHaveBeenCalledWith("Clínica Nueva"));
  });
});
