import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RETINAL_IMAGE_MAX_BYTES } from "../domain/supabaseIntegration";
import { ImageCaptureControl } from "./ScreeningManagement";

function renderControl(onUpload = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ImageCaptureControl
      laterality="OD"
      image={null}
      canUpload
      canDelete={false}
      saving={false}
      onUpload={onUpload}
      onDelete={vi.fn()}
    />,
  );
  return onUpload;
}

describe("carga de imágenes retinales", () => {
  it("rechaza un archivo mayor de 15 MiB antes de llamar al servicio", () => {
    const onUpload = renderControl();
    const oversized = new File([new Uint8Array(RETINAL_IMAGE_MAX_BYTES + 1)], "grande.png", { type: "image/png" });

    fireEvent.change(screen.getByLabelText("Cargar imagen OD"), { target: { files: [oversized] } });

    expect(screen.getByRole("alert")).toHaveTextContent("15 MB");
    expect(screen.getByLabelText("Cargar imagen OD")).toHaveAttribute("aria-invalid", "true");
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("acepta el tamaño límite y borra el error previo", async () => {
    const onUpload = renderControl();
    const input = screen.getByLabelText("Cargar imagen OD");
    fireEvent.change(input, { target: { files: [new File([], "vacía.png", { type: "image/png" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("vacío");

    const exactLimit = new File([new Uint8Array(RETINAL_IMAGE_MAX_BYTES)], "límite.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [exactLimit] } });

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(exactLimit));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
