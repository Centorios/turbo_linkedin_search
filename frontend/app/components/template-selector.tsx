import type { CvTemplate } from "./cv-preview";

export function TemplateSelector({ value, onChange }: { value: CvTemplate; onChange: (value: CvTemplate) => void }) {
  return (
    <fieldset data-testid="template-selector">
      <legend>Plantilla</legend>
      <button type="button" aria-pressed={value === "ats"} onClick={() => onChange("ats")} data-testid="template-ats">Minimalista ATS</button>
      <button type="button" aria-pressed={value === "creative"} onClick={() => onChange("creative")} data-testid="template-creative">Creativo PDF</button>
    </fieldset>
  );
}
