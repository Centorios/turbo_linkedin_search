import type { StructuredCv } from "../types/cv";
import { BaseCvPdfDocument } from "./pdf/base-document";
import { BannerCvPdfDocument } from "./pdf/creative-banner";
import { SerifCvPdfDocument } from "./pdf/creative-serif";
import { SidebarCvPdfDocument } from "./pdf/creative-sidebar";
import { TimelineCvPdfDocument } from "./pdf/creative-timeline";
import { slugify } from "./pdf/shared";
import { templateFileSuffix, type CvTemplate } from "./registry";

export function buildCvFileName(cv: StructuredCv, template: CvTemplate): string {
  const namePart = slugify(cv.personalInfo.fullName) || "cv";
  return `${namePart}-${templateFileSuffix(template)}.pdf`;
}

export function CvPdfDocument({ cv, template }: { cv: StructuredCv; template: CvTemplate }) {
  switch (template) {
    case "creative-sidebar":
      return <SidebarCvPdfDocument cv={cv} />;
    case "creative-banner":
      return <BannerCvPdfDocument cv={cv} />;
    case "creative-serif":
      return <SerifCvPdfDocument cv={cv} />;
    case "creative-timeline":
      return <TimelineCvPdfDocument cv={cv} />;
    default:
      return <BaseCvPdfDocument cv={cv} template={template} />;
  }
}
