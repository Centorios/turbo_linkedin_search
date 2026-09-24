import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CvTemplate } from "../components/cv-preview";
import type { Certification, Education, Experience, PartialDate, StructuredCv } from "../types/cv";

const ACCENT_COLOR = "#2563EB";
const MUTED_COLOR = "#475569";

const styles = StyleSheet.create({
  page: { paddingHorizontal: 40, paddingVertical: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  contact: { fontSize: 9, color: MUTED_COLOR, marginBottom: 10 },
  summary: { fontSize: 10, lineHeight: 1.4, marginBottom: 12 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  item: { marginBottom: 6 },
  itemTitle: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  itemSubtitle: { fontSize: 9, color: MUTED_COLOR, marginBottom: 2 },
  bullet: { fontSize: 9.5, lineHeight: 1.35, marginBottom: 1 },
  inlineList: { fontSize: 9.5, lineHeight: 1.4 },
  emptyState: { fontSize: 9, color: MUTED_COLOR, fontStyle: "italic" },
});

const accentStyles = StyleSheet.create({
  name: { color: ACCENT_COLOR },
  sectionTitle: { color: ACCENT_COLOR },
});

function formatDateRange(startDate: PartialDate, endDate: PartialDate): string {
  return [startDate, endDate].filter(Boolean).join(" - ");
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildCvFileName(cv: StructuredCv, template: CvTemplate): string {
  const namePart = slugify(cv.personalInfo.fullName) || "cv";
  const templatePart = template === "creative" ? "creativo" : "ats";
  return `${namePart}-${templatePart}.pdf`;
}

function ExperienceSection({ experience }: { experience: Experience[] }) {
  if (!experience.length) {
    return <Text style={styles.emptyState}>Sin experiencia registrada.</Text>;
  }
  return (
    <>
      {experience.map((item, index) => {
        const subtitle = [item.company, item.location, formatDateRange(item.startDate, item.endDate)].filter(Boolean).join("  ·  ");
        return (
          <View key={`${item.company}-${item.title}-${index}`} style={styles.item}>
            <Text style={styles.itemTitle}>{item.title || "Puesto sin título"}</Text>
            {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
            {item.achievements.map((achievement, achievementIndex) => (
              <Text key={achievementIndex} style={styles.bullet}>{"• " + achievement}</Text>
            ))}
          </View>
        );
      })}
    </>
  );
}

function EducationSection({ education }: { education: Education[] }) {
  if (!education.length) {
    return <Text style={styles.emptyState}>Sin educación registrada.</Text>;
  }
  return (
    <>
      {education.map((item, index) => {
        const subtitle = [item.institution, formatDateRange(item.startDate, item.endDate)].filter(Boolean).join("  ·  ");
        return (
          <View key={`${item.institution}-${item.program}-${index}`} style={styles.item}>
            <Text style={styles.itemTitle}>{item.program || "Programa sin especificar"}</Text>
            {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
            {item.description ? <Text style={styles.bullet}>{item.description}</Text> : null}
          </View>
        );
      })}
    </>
  );
}

function CertificationsSection({ certifications }: { certifications: Certification[] }) {
  if (!certifications.length) {
    return <Text style={styles.emptyState}>Sin certificaciones registradas.</Text>;
  }
  return (
    <>
      {certifications.map((item, index) => {
        const subtitle = [item.issuer, formatDateRange(item.issueDate, item.expirationDate)].filter(Boolean).join("  ·  ");
        return (
          <View key={`${item.issuer}-${item.name}-${index}`} style={styles.item}>
            <Text style={styles.itemTitle}>{item.name || "Certificación sin nombre"}</Text>
            {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
            {item.credential ? <Text style={styles.bullet}>{item.credential}</Text> : null}
          </View>
        );
      })}
    </>
  );
}

export function CvPdfDocument({ cv, template }: { cv: StructuredCv; template: CvTemplate }) {
  const accent = template === "creative" ? accentStyles : null;
  const contact = [cv.personalInfo.email, cv.personalInfo.phone, cv.personalInfo.location, cv.personalInfo.linkedin, cv.personalInfo.website]
    .filter(Boolean)
    .join("  ·  ");
  const skills = [...cv.skills.hard, ...cv.skills.soft].join(", ");
  const languages = cv.languages.map((language) => [language.name, language.proficiency].filter(Boolean).join(" - ")).join(", ");

  return (
    <Document title={cv.personalInfo.fullName || "CV"}>
      <Page size="A4" style={styles.page}>
        <Text style={accent ? [styles.name, accent.name] : styles.name}>{cv.personalInfo.fullName || "Nombre profesional"}</Text>
        {contact ? <Text style={styles.contact}>{contact}</Text> : null}
        {cv.summary ? <Text style={styles.summary}>{cv.summary}</Text> : null}

        <View style={styles.section}>
          <Text style={accent ? [styles.sectionTitle, accent.sectionTitle] : styles.sectionTitle}>Experiencia</Text>
          <ExperienceSection experience={cv.experience} />
        </View>

        <View style={styles.section}>
          <Text style={accent ? [styles.sectionTitle, accent.sectionTitle] : styles.sectionTitle}>Educación</Text>
          <EducationSection education={cv.education} />
        </View>

        <View style={styles.section}>
          <Text style={accent ? [styles.sectionTitle, accent.sectionTitle] : styles.sectionTitle}>Habilidades</Text>
          <Text style={skills ? styles.inlineList : styles.emptyState}>{skills || "Sin habilidades registradas."}</Text>
        </View>

        <View style={styles.section}>
          <Text style={accent ? [styles.sectionTitle, accent.sectionTitle] : styles.sectionTitle}>Idiomas</Text>
          <Text style={languages ? styles.inlineList : styles.emptyState}>{languages || "Sin idiomas registrados."}</Text>
        </View>

        <View style={styles.section}>
          <Text style={accent ? [styles.sectionTitle, accent.sectionTitle] : styles.sectionTitle}>Certificaciones</Text>
          <CertificationsSection certifications={cv.certifications} />
        </View>
      </Page>
    </Document>
  );
}
