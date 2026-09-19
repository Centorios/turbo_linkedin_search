import type { StructuredCv } from "../types/cv";
import { MinimalistaAts } from "../templates/minimalista-ats";
import { CreativoPdf } from "../templates/creativo-pdf";

export type CvTemplate = "ats" | "creative";

export function CvPreview({ cv, template }: { cv: StructuredCv; template: CvTemplate }) {
  return (
    <section aria-label="Vista previa del CV" data-testid="cv-preview">
      {template === "ats" ? <MinimalistaAts cv={cv} /> : <CreativoPdf cv={cv} />}
    </section>
  );
}
