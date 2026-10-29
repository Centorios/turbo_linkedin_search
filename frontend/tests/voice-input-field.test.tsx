import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VoiceInputField } from "../app/components/voice-input-field";
import { appendDictation } from "../app/lib/speech-dictation";
import { FakeRecognition, installSpeechRecognition, removeSpeechRecognition } from "./speech-test-utils";

function Harness({ initial = "", disabled = false }: { initial?: string; disabled?: boolean }) {
  const [text, setText] = useState(initial);
  return (
    <VoiceInputField
      id="bio"
      fieldLabel="Biografía"
      disabled={disabled}
      onTranscript={(chunk) => setText((current) => appendDictation(current, chunk))}
    >
      <textarea data-testid="bio" aria-label="Biografía" value={text} onChange={(event) => setText(event.target.value)} />
    </VoiceInputField>
  );
}

const button = () => screen.getByTestId("voice-input-bio");
const textarea = () => screen.getByTestId("bio") as HTMLTextAreaElement;

beforeEach(() => installSpeechRecognition());

afterEach(() => {
  cleanup();
  removeSpeechRecognition();
});

describe("Botón de dictado por voz", () => {
  it("muestra el micrófono con nombre accesible en español", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Dictar por voz en Biografía" })).toBe(button());
    expect(button().getAttribute("aria-pressed")).toBe("false");
    // The button must not be found as the field: getByLabel("Biografía") is the textarea only.
    expect(screen.getAllByLabelText("Biografía")).toEqual([textarea()]);
  });

  it("agrega lo dictado al final sin borrar lo escrito y muestra lo provisorio aparte", () => {
    render(<Harness initial="Soy diseñadora." />);
    fireEvent.click(button());

    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Detener dictado en Biografía" })).toBe(button());
    expect(screen.getByTestId("voice-input-status-bio").textContent).toContain("Escuchando…");

    act(() => FakeRecognition.last.emit(["trabajé en", false]));
    expect(textarea().value).toBe("Soy diseñadora.");
    expect(screen.getByTestId("voice-input-status-bio").textContent).toContain("trabajé en");

    act(() => FakeRecognition.last.emit(["Trabajé en Acme cinco años", true]));
    expect(textarea().value).toBe("Soy diseñadora. Trabajé en Acme cinco años");

    fireEvent.change(textarea(), { target: { value: "Soy diseñadora. Trabajé en Acme cinco años. Editado." } });
    act(() => FakeRecognition.last.emit(["Lideré el equipo", true]));
    expect(textarea().value).toBe("Soy diseñadora. Trabajé en Acme cinco años. Editado. Lideré el equipo");
  });

  it("tocar de nuevo detiene el dictado", () => {
    render(<Harness />);
    fireEvent.click(button());
    const recognition = FakeRecognition.last;

    fireEvent.click(button());

    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(button().getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("voice-input-status-bio").textContent).toBe("");
  });

  it("explica el error en rioplatense y deja seguir escribiendo", () => {
    render(<Harness />);
    fireEvent.click(button());
    act(() => FakeRecognition.last.fail("not-allowed"));
    act(() => FakeRecognition.last.end());

    expect(screen.getByTestId("voice-input-error-bio").textContent).toContain("No diste permiso para usar el micrófono");
    expect(button().getAttribute("aria-pressed")).toBe("false");
    fireEvent.change(textarea(), { target: { value: "Escribo igual" } });
    expect(textarea().value).toBe("Escribo igual");
  });

  it("al deshabilitarse (por ejemplo, al generar) se apaga el micrófono", () => {
    const view = render(<Harness />);
    fireEvent.click(button());
    const recognition = FakeRecognition.last;

    view.rerender(<Harness disabled />);

    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect((button() as HTMLButtonElement).disabled).toBe(true);
    expect(button().getAttribute("aria-pressed")).toBe("false");
  });

  it("al salir de la pantalla se apaga el micrófono", () => {
    const view = render(<Harness />);
    fireEvent.click(button());
    const recognition = FakeRecognition.last;

    view.unmount();

    expect(recognition.abort).toHaveBeenCalledTimes(1);
  });

  it("sin dictado en el navegador muestra solo el campo", () => {
    removeSpeechRecognition();
    render(<Harness initial="Hola" />);

    expect(screen.queryByTestId("voice-input-bio")).toBeNull();
    expect(screen.queryByTestId("voice-input-status-bio")).toBeNull();
    expect(textarea().value).toBe("Hola");
  });
});
