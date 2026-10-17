import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TemplateSelector } from "../app/components/template-selector";
import { CREATIVE_STYLES, type CvTemplate } from "../app/templates/registry";

afterEach(cleanup);

function pressed(testId: string) {
  return screen.getByTestId(testId).getAttribute("aria-pressed");
}

function Harness({ initial = "ats", onChange }: { initial?: CvTemplate; onChange?: (value: CvTemplate) => void }) {
  const [value, setValue] = useState<CvTemplate>(initial);
  return (
    <>
      <TemplateSelector value={value} onChange={(next) => { setValue(next); onChange?.(next); }} />
      <output data-testid="current">{value}</output>
    </>
  );
}

describe("Selector de plantillas", () => {
  it("muestra solo ATS y Creativo, sin estilos, cuando la plantilla es ATS", () => {
    render(<Harness />);
    expect(pressed("template-ats")).toBe("true");
    expect(pressed("template-creative")).toBe("false");
    expect(screen.queryByTestId("creative-style-selector")).toBeNull();
  });

  it("al elegir Creativo muestra los 5 estilos, con el clásico activo", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("template-creative"));
    expect(screen.getByTestId("current").textContent).toBe("creative");
    expect(CREATIVE_STYLES).toHaveLength(5);
    for (const style of CREATIVE_STYLES) {
      expect(screen.getByTestId(`template-style-${style.id}`).textContent).toContain(style.label);
    }
    expect(pressed("template-style-creative")).toBe("true");
    expect(pressed("template-creative")).toBe("true");
    expect(pressed("template-ats")).toBe("false");
  });

  it("elegir un estilo notifica su id y marca solo ese estilo", () => {
    const onChange = vi.fn();
    render(<Harness initial="creative" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("template-style-creative-sidebar"));
    expect(onChange).toHaveBeenLastCalledWith("creative-sidebar");
    expect(pressed("template-style-creative-sidebar")).toBe("true");
    expect(pressed("template-style-creative")).toBe("false");
    expect(pressed("template-creative")).toBe("true");
  });

  it("al volver a Creativo recuerda el último estilo elegido", () => {
    render(<Harness initial="creative" />);
    fireEvent.click(screen.getByTestId("template-style-creative-timeline"));
    fireEvent.click(screen.getByTestId("template-ats"));
    expect(screen.getByTestId("current").textContent).toBe("ats");
    expect(screen.queryByTestId("creative-style-selector")).toBeNull();
    fireEvent.click(screen.getByTestId("template-creative"));
    expect(screen.getByTestId("current").textContent).toBe("creative-timeline");
    expect(pressed("template-style-creative-timeline")).toBe("true");
  });

  it("muestra el estilo correcto si ya llega un estilo creativo", () => {
    render(<Harness initial="creative-serif" />);
    expect(pressed("template-style-creative-serif")).toBe("true");
    expect(pressed("template-creative")).toBe("true");
  });
});
