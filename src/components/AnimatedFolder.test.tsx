import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnimatedFolder } from "./AnimatedFolder";

const file = new File(["image"], "retina.png", { type: "image/png" });
const other = new File(["other"], "other.webp", { type: "image/webp" });

describe("AnimatedFolder upload contract", () => {
  it("uses a native non-submit button to open the picker and retries the same file", () => {
    const onFiles = vi.fn();
    render(<AnimatedFolder inputLabel="Cargar imagen OD" onFiles={onFiles} />);
    const input = screen.getByLabelText<HTMLInputElement>("Cargar imagen OD");
    const picker = vi.spyOn(input, "click");
    const button = screen.getByRole("button", { name: "Elegir imagen" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("tabindex", "-1");
    fireEvent.click(button);
    expect(picker).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { files: [file] } });
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledTimes(2);
    expect(onFiles).toHaveBeenLastCalledWith([file]);
  });

  it("preserves validation feedback by forwarding invalid files from picker and drop", () => {
    const onFiles = vi.fn();
    const invalid = new File(["svg"], "logo.svg", { type: "image/svg+xml" });
    const { container } = render(<AnimatedFolder inputLabel="Logo" onFiles={onFiles} />);
    fireEvent.change(screen.getByLabelText("Logo"), { target: { files: [invalid, file] } });
    fireEvent.drop(container.firstElementChild!, { dataTransfer: { types: ["Files"], files: [invalid, file] } });
    expect(onFiles.mock.calls).toEqual([[[invalid]], [[invalid]]]);
  });

  it("supports multiple files explicitly and ignores empty/cancelled picks and text drops", () => {
    const onFiles = vi.fn();
    const { container } = render(<AnimatedFolder inputLabel="Images" multiple onFiles={onFiles} />);
    const input = screen.getByLabelText("Images");
    expect(input).toHaveAttribute("multiple");
    fireEvent.change(input, { target: { files: [] } });
    fireEvent.drop(container.firstElementChild!, { dataTransfer: { types: ["text/plain"], files: [] } });
    expect(onFiles).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [file, other] } });
    fireEvent.drop(container.firstElementChild!, { dataTransfer: { types: ["Files"], files: [file, other] } });
    expect(onFiles.mock.calls).toEqual([[[file, other]], [[file, other]]]);
  });

  it.each([{ disabled: true }, { busy: true }])("blocks picker and drop while unavailable: %o", (state) => {
    const onFiles = vi.fn();
    const { container } = render(<AnimatedFolder inputLabel="Logo" onFiles={onFiles} {...state} />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByLabelText("Logo")).toBeDisabled();
    const transfer = { types: ["Files"], files: [file], dropEffect: "copy" };
    fireEvent.dragOver(container.firstElementChild!, { dataTransfer: transfer });
    expect(transfer.dropEffect).toBe("none");
    // Cancel browser file navigation even when uploads are blocked.
    expect(fireEvent.drop(container.firstElementChild!, { dataTransfer: transfer })).toBe(false);
    fireEvent.change(screen.getByLabelText("Logo"), { target: { files: [file] } });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("keeps drag feedback across child boundaries and clears it on drop", () => {
    const { container } = render(<AnimatedFolder inputLabel="Logo" onFiles={vi.fn()} />);
    const root = container.firstElementChild!;
    fireEvent.dragEnter(root, { dataTransfer: { types: ["Files"] } });
    expect(root).toHaveAttribute("data-state", "dragging");
    fireEvent(root, new MouseEvent("dragleave", { bubbles: true, relatedTarget: screen.getByRole("button") }));
    expect(root).toHaveAttribute("data-state", "dragging");
    fireEvent.drop(root, { dataTransfer: { types: ["Files"], files: [file] } });
    expect(root).toHaveAttribute("data-state", "idle");
    fireEvent.dragEnter(root, { dataTransfer: { types: ["Files"] } });
    fireEvent(root, new MouseEvent("dragleave", { bubbles: true, relatedTarget: document.body }));
    expect(root).toHaveAttribute("data-state", "idle");
  });

  it("associates caller hints/errors with both controls and uses unique description IDs", () => {
    render(<>
      <p id="upload-error">Archivo demasiado grande</p>
      <AnimatedFolder inputLabel="OD" description="Hasta 15 MB" describedBy="upload-error" invalid onFiles={vi.fn()} />
      <AnimatedFolder inputLabel="OI" description="Hasta 15 MB" onFiles={vi.fn()} />
    </>);
    expect(screen.getByLabelText("OD")).toHaveAccessibleDescription("Hasta 15 MB Archivo demasiado grande");
    expect(screen.getAllByRole("button")[0]).toHaveAccessibleDescription("Hasta 15 MB Archivo demasiado grande");
    expect(screen.getByLabelText("OD")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("OD").getAttribute("aria-describedby")).not.toBe(screen.getByLabelText("OI").getAttribute("aria-describedby"));
  });
});
