import { isCreativeTemplate, type CvTemplate } from "../templates/registry";
import type { StructuredCv } from "../types/cv";
import { getProfilePhotoUrl } from "./profile-photo-client";

// Single entry point for building the CV PDF. The preview and the download
// both use it, so what the user sees is exactly what they download.
export async function renderCvPdf(cv: StructuredCv, template: CvTemplate): Promise<Blob> {
  const [{ pdf }, { CvPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("../templates/cv-pdf-document"),
  ]);
  let printableCv = cv;
  if (isCreativeTemplate(template) && cv.personalInfo.photoPath) {
    try {
      const photoUrl = await getProfilePhotoUrl(cv.personalInfo.photoPath);
      printableCv = { ...cv, personalInfo: { ...cv.personalInfo, photoUrl } };
    } catch {
      // Historical photos can be removed; the document remains exportable.
      printableCv = { ...cv, personalInfo: { ...cv.personalInfo, photoUrl: null } };
    }
  }
  return pdf(<CvPdfDocument cv={printableCv} template={template} />).toBlob();
}
