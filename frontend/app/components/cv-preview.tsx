import type { StructuredCv } from "../types/cv";
import { MinimalistaAts } from "../templates/minimalista-ats";
import { CreativoPdf } from "../templates/creativo-pdf";

export type CvTemplate = "ats" | "creative";

export function CvPreview({ cv, template }: { cv: StructuredCv; template: CvTemplate }) {
  return (
    <section
      aria-label="Vista previa del CV"
      data-testid="cv-preview"
      className="mx-auto aspect-[1/1.4142] w-full max-w-[620px] overflow-y-auto rounded border border-border bg-surface p-8 shadow-sm sm:p-10"
    >
      {template === "ats" ? <MinimalistaAts cv={cv} /> : <CreativoPdf cv={cv} />}
    </section>
  );
}
