import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../app/components/confirm-dialog";

afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="¿Eliminar este CV?"
      description="Esta acción no se puede deshacer."
      confirmLabel="Eliminar CV"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe("Diálogo de confirmación", () => {
  it("no muestra nada cuando está cerrado", () => {
    render(<ConfirmDialog open={false} title="t" description="d" confirmLabel="Ok" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
  });

  it("es un alertdialog accesible con título y descripción", () => {
    setup();
    const dialog = screen.getByRole("alertdialog", { name: "¿Eliminar este CV?" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(dialog.textContent).toContain("Esta acción no se puede deshacer.");
    expect(screen.getByTestId("confirm-dialog-confirm").textContent).toBe("Eliminar CV");
    expect(screen.getByTestId("confirm-dialog-cancel").textContent).toBe("Cancelar");
  });

  it("el foco inicial queda en Cancelar, la opción segura", () => {
    setup();
    expect(document.activeElement).toBe(screen.getByTestId("confirm-dialog-cancel"));
  });

  it("confirmar y cancelar llaman a su acción", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape y el clic en el fondo cancelan, pero el clic dentro del panel no", () => {
    const { onCancel } = setup();
    fireEvent.keyDown(screen.getByTestId("confirm-dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByTestId("confirm-dialog"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByTestId("confirm-dialog-overlay"));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("Tab no se escapa del diálogo", () => {
    setup();
    const cancel = screen.getByTestId("confirm-dialog-cancel");
    const confirm = screen.getByTestId("confirm-dialog-confirm");
    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it("mientras trabaja bloquea los botones y no se cierra", () => {
    const { onCancel } = setup({ isBusy: true });
    expect((screen.getByTestId("confirm-dialog-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("confirm-dialog-cancel") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByTestId("confirm-dialog"), { key: "Escape" });
    fireEvent.mouseDown(screen.getByTestId("confirm-dialog-overlay"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("al cerrarse devuelve el foco a quien lo abrió", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button data-testid="opener" onClick={() => setOpen(true)}>Eliminar</button>
          <ConfirmDialog open={open} title="t" description="d" confirmLabel="Ok" onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByTestId("opener");
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByTestId("confirm-dialog-cancel"));
    fireEvent.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
