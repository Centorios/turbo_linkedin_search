import type { ComponentProps } from "react";
import { Text, View } from "@react-pdf/renderer";
import type { Certification, Education, Experience, PartialDate, StructuredCv } from "../../types/cv";

// Helpers and copy shared by every PDF template, so all of them show the same
// content and the same empty-state texts.

export const FALLBACK_NAME = "Nombre profesional";

export const EMPTY_TEXT = {
  experience: "Sin experiencia registrada.",
  education: "Sin educación registrada.",
  skills: "Sin habilidades registradas.",
  languages: "Sin idiomas registrados.",
  certifications: "Sin certificaciones registradas.",
} as const;

export const CREATIVE_TITLES = {
  eyebrow: "Perfil profesional",
  experience: "Trayectoria",
  education: "Formación",
  skills: "Competencias",
  languages: "Idiomas",
  certifications: "Certificaciones",
} as const;

export function formatDateRange(startDate: PartialDate, endDate: PartialDate): string {
  return [startDate, endDate].filter(Boolean).join(" - ");
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function contactItems(cv: StructuredCv): string[] {
  const { email, phone, location, linkedin, website } = cv.personalInfo;
  return [email, phone, location, linkedin, website].filter(Boolean);
}

export function skillItems(cv: StructuredCv): string[] {
  return [...cv.skills.hard, ...cv.skills.soft];
}

export function languageItems(cv: StructuredCv): string[] {
  return cv.languages.map((language) => [language.name, language.proficiency].filter(Boolean).join(" - "));
}

export function experienceMeta(item: Experience) {
  return {
    title: item.title || "Puesto sin título",
    subtitle: joinNonEmpty([item.company, item.location], " · "),
    dateRange: formatDateRange(item.startDate, item.endDate),
  };
}

export function educationMeta(item: Education) {
  return {
    title: joinNonEmpty([item.program, item.institution], ", ") || "Programa sin especificar",
    dateRange: formatDateRange(item.startDate, item.endDate),
  };
}

// Creative styles never show certification dates or credential ids.
export function certificationMeta(item: Certification) {
  return { title: item.name || "Certificación sin nombre", issuer: item.issuer };
}

export function joinNonEmpty(parts: string[], separator: string): string {
  return parts.filter(Boolean).join(separator);
}

// A single style object (as returned by StyleSheet.create), not an array.
type PdfStyle = Exclude<NonNullable<ComponentProps<typeof View>["style"]>, readonly unknown[]>;

// One achievement per line with a hanging bullet.
export function Achievements({ items, textStyle, bulletStyle }: { items: string[]; textStyle: PdfStyle; bulletStyle?: PdfStyle }) {
  return (
    <>
      {items.map((achievement, index) => (
        <View key={`${index}-${achievement}`} style={{ flexDirection: "row", marginBottom: 1.5 }}>
          <Text style={{ ...textStyle, ...bulletStyle, width: 9 }}>•</Text>
          <Text style={{ ...textStyle, flexGrow: 1, flexShrink: 1 }}>{achievement}</Text>
        </View>
      ))}
    </>
  );
}
