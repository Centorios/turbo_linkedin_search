import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilePickerButton } from "../app/components/file-picker-button";

afterEach(cleanup);

const testIds = { input: "picker-input", browse: "picker-browse", filename: "picker-filename" };

function setup(props: Partial<React.ComponentProps<typeof FilePickerButton>> = {}) {
  const onSelect = vi.fn();
  render(<FilePickerButton id="picker" accept="application/pdf" onSelect={onSelect} testIds={testIds} {...props} />);
  return onSelect;
}

describe("Botón Buscar", () => {
  it("reemplaza el \"Browse...\" nativo por un botón \"Buscar\" con el color principal", () => {
    setup();
    const browse = screen.getByTestId("picker-browse");
    expect(browse.tagName).toBe("LABEL");
    expect(browse.textContent).toBe("Buscar");
    expect(browse.getAttribute("for")).toBe("picker");
    expect(browse.className).toContain("bg-primary");
    expect(browse.className).toContain("text-on-primary");
  });

  it("el input sigue accesible, solo oculto a la vista", () => {
    setup({ describedBy: "hint" });
    const input = screen.getByTestId("picker-input");
    expect(input.className).toContain("sr-only");
    expect(input.getAttribute("accept")).toBe("application/pdf");
    expect(input.getAttribute("aria-describedby")).toBe("hint");
  });

  it("muestra el archivo elegido o que no hay ninguno", () => {
    setup();
    expect(screen.getByTestId("picker-filename").textContent).toBe("Ningún archivo seleccionado");
    cleanup();
    setup({ fileName: "mi-cv.pdf" });
    expect(screen.getByTestId("picker-filename").textContent).toBe("mi-cv.pdf");
  });

  it("entrega el archivo elegido y deja volver a elegir el mismo", () => {
    const onSelect = setup();
    const file = new File(["%PDF"], "cv.pdf", { type: "application/pdf" });
    const input = screen.getByTestId("picker-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(onSelect).toHaveBeenCalledWith(file);
    expect(input.value).toBe("");
  });

  it("se deshabilita junto con su botón y muestra acciones extra", () => {
    setup({ disabled: true, children: <button type="button">Usar cámara</button> });
    expect((screen.getByTestId("picker-input") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Usar cámara" })).toBeTruthy();
  });
});
