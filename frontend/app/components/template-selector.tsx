import type { CvTemplate } from "./cv-preview";

export function TemplateSelector({ value, onChange }: { value: CvTemplate; onChange: (value: CvTemplate) => void }) {
  return (
    <fieldset data-testid="template-selector" className="flex flex-col gap-1.5">
      <legend className="text-label-xs uppercase text-text-muted">Plantilla</legend>
      <div className="inline-flex w-fit gap-1 rounded-lg bg-subtle p-1">
        <button
          type="button"
          aria-pressed={value === "ats"}
          onClick={() => onChange("ats")}
          data-testid="template-ats"
          className={`focus-ring rounded-md px-3 py-1.5 text-label-xs transition-colors ${
            value === "ats" ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
          }`}
        >
          Minimalista ATS
        </button>
        <button
          type="button"
          aria-pressed={value === "creative"}
          onClick={() => onChange("creative")}
          data-testid="template-creative"
          className={`focus-ring rounded-md px-3 py-1.5 text-label-xs transition-colors ${
            value === "creative" ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
          }`}
        >
          Creativo PDF
        </button>
      </div>
    </fieldset>
  );
}
