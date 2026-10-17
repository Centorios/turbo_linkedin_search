"use client";

import { useRef } from "react";
import {
  CREATIVE_STYLES, DEFAULT_CREATIVE_STYLE, isCreativeTemplate, type CreativeStyle, type CvTemplate,
} from "../templates/registry";

const toggleClass = (active: boolean) =>
  `focus-ring rounded-md px-3 py-1.5 text-label-xs transition-colors ${
    active ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
  }`;

export function TemplateSelector({ value, onChange }: { value: CvTemplate; onChange: (value: CvTemplate) => void }) {
  const isCreative = isCreativeTemplate(value);
  // Returning to "Creativo" restores the style the person had picked before.
  const lastStyle = useRef<CreativeStyle>(DEFAULT_CREATIVE_STYLE);
  if (isCreative) lastStyle.current = value;

  return (
    <fieldset data-testid="template-selector" className="flex flex-col gap-1.5">
      <legend className="text-label-xs uppercase text-text-muted">Plantilla</legend>
      <div className="inline-flex w-fit gap-1 rounded-lg bg-subtle p-1">
        <button
          type="button"
          aria-pressed={!isCreative}
          onClick={() => onChange("ats")}
          data-testid="template-ats"
          className={toggleClass(!isCreative)}
        >
          Minimalista ATS
        </button>
        <button
          type="button"
          aria-pressed={isCreative}
          onClick={() => onChange(lastStyle.current)}
          data-testid="template-creative"
          className={toggleClass(isCreative)}
        >
          Creativo PDF
        </button>
      </div>
      {isCreative && (
        <div role="group" aria-label="Estilo creativo" data-testid="creative-style-selector" className="flex flex-col gap-1.5">
          <span className="text-label-xs uppercase text-text-muted">Estilo</span>
          <div className="flex flex-wrap gap-1.5">
            {CREATIVE_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                aria-pressed={value === style.id}
                onClick={() => onChange(style.id)}
                data-testid={`template-style-${style.id}`}
                className={`focus-ring flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-label-xs transition-colors ${
                  value === style.id
                    ? "border-primary bg-surface text-text shadow-sm"
                    : "border-border bg-subtle text-text-muted hover:text-text"
                }`}
              >
                <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: style.swatch }} />
                {style.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  );
}
