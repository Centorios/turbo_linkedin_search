// Single source of truth for the CV templates. Adding a style means adding an
// entry here plus a document in templates/pdf/ and a case in cv-pdf-document.tsx.

export type CreativeStyle =
  | "creative"
  | "creative-sidebar"
  | "creative-banner"
  | "creative-serif"
  | "creative-timeline";

export type CvTemplate = "ats" | CreativeStyle;

export type CreativeStyleOption = {
  id: CreativeStyle;
  label: string;
  /** Accent color shown as a sample in the style picker. */
  swatch: string;
  /** Suffix used in the downloaded file name. */
  fileSuffix: string;
};

// "creative" keeps its id for the classic style so existing test ids and file
// names stay valid.
export const CREATIVE_STYLES: readonly CreativeStyleOption[] = [
  { id: "creative", label: "Clásico", swatch: "#2563EB", fileSuffix: "creativo" },
  { id: "creative-sidebar", label: "Barra lateral", swatch: "#1E293B", fileSuffix: "creativo-barra-lateral" },
  { id: "creative-banner", label: "Encabezado de color", swatch: "#115E59", fileSuffix: "creativo-encabezado" },
  { id: "creative-serif", label: "Elegante serif", swatch: "#7F1D1D", fileSuffix: "creativo-serif" },
  { id: "creative-timeline", label: "Línea de tiempo", swatch: "#0E7490", fileSuffix: "creativo-linea-de-tiempo" },
];

export const CV_TEMPLATES: readonly CvTemplate[] = ["ats", ...CREATIVE_STYLES.map((style) => style.id)];

export const DEFAULT_CREATIVE_STYLE: CreativeStyle = "creative";

export function isCreativeTemplate(template: CvTemplate): template is CreativeStyle {
  return template !== "ats";
}

export function templateFileSuffix(template: CvTemplate): string {
  if (!isCreativeTemplate(template)) return "ats";
  return CREATIVE_STYLES.find((style) => style.id === template)?.fileSuffix ?? "creativo";
}
