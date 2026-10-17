import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Certification, Education, Experience, StructuredCv } from "../../types/cv";
import { formatDateRange } from "./shared";

// ATS and the classic creative style share this layout; the other creative
// styles have their own documents in this folder.
export type BaseTemplate = "ats" | "creative";

const ACCENT_COLOR = "#2563EB";
const MUTED_COLOR = "#475569";

const styles = StyleSheet.create({
  page: { paddingHorizontal: 40, paddingVertical: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  atsName: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2, textTransform: "uppercase" },
  creativeHeader: { flexDirection: "row", alignItems: "flex-start", borderLeftWidth: 4, borderLeftColor: ACCENT_COLOR, paddingLeft: 12, marginBottom: 10 },
  creativeHeaderText: { flexGrow: 1, flexShrink: 1, marginRight: 12 },
  // Text does not wrap to the room left by the photo unless it has an explicit width:
  // A4 (595) - page padding (80) - border (4) - left padding (12) - photo (68) - margin (12).
  creativeHeaderTextWithPhoto: { width: 419 },
  eyebrow: { fontSize: 8, color: ACCENT_COLOR, textTransform: "uppercase", marginBottom: 3 },
  profilePhoto: { width: 68, height: 68, borderRadius: 34, objectFit: "cover", flexShrink: 0 },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  contact: { fontSize: 9, color: MUTED_COLOR, marginBottom: 10 },
  summary: { fontSize: 10, lineHeight: 1.4, marginBottom: 12 },
  summaryTitle: { fontSize: 8, color: MUTED_COLOR, textTransform: "uppercase", marginBottom: 4 },
  divider: { height: 1, backgroundColor: "#CBD5E1", marginBottom: 10 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  item: { marginBottom: 6 },
  experienceHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
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

function ExperienceSection({ experience, template }: { experience: Experience[]; template: BaseTemplate }) {
  if (!experience.length) {
    return <Text style={styles.emptyState}>Sin experiencia registrada.</Text>;
  }
  return (
    <>
      {experience.map((item, index) => {
        const subtitle = [item.company, item.location, formatDateRange(item.startDate, item.endDate)].filter(Boolean).join("  ·  ");
        const dateRange = formatDateRange(item.startDate, item.endDate);
        return (
          <View key={`${item.company}-${item.title}-${index}`} style={styles.item}>
            {template === "ats" ? (
              <View style={styles.experienceHeading}>
                <Text style={styles.itemTitle}>{[item.title, item.company].filter(Boolean).join(" — ") || "Puesto sin título"}</Text>
                {dateRange ? <Text style={styles.itemSubtitle}>{dateRange}</Text> : null}
              </View>
            ) : (
              <>
                <Text style={styles.itemTitle}>{item.title || "Puesto sin título"}</Text>
                {(item.company || item.location) ? <Text style={styles.itemSubtitle}>{[item.company, item.location].filter(Boolean).join(" · ")}</Text> : null}
                {dateRange ? <Text style={styles.itemSubtitle}>{dateRange}</Text> : null}
              </>
            )}
            {template === "ats" && item.location ? <Text style={styles.itemSubtitle}>{item.location}</Text> : null}
            {item.achievements.length > 0 ? (
              <Text style={styles.bullet}>
                {template === "ats" ? item.achievements.map((achievement) => `• ${achievement}`).join("\n") : item.achievements.join(" · ")}
              </Text>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

function EducationSection({ education, template }: { education: Education[]; template: BaseTemplate }) {
  if (!education.length) {
    return <Text style={styles.emptyState}>Sin educación registrada.</Text>;
  }
  return (
    <>
      {education.map((item, index) => {
        const dateRange = formatDateRange(item.startDate, item.endDate);
        return (
          <View key={`${item.institution}-${item.program}-${index}`} style={styles.item}>
            {template === "ats" ? (
              <View style={styles.experienceHeading}>
                <Text style={styles.itemTitle}>{[item.program, item.institution].filter(Boolean).join(" — ") || "Programa sin especificar"}</Text>
                {dateRange ? <Text style={styles.itemSubtitle}>{dateRange}</Text> : null}
              </View>
            ) : (
              <Text style={styles.itemTitle}>
                {[item.program, item.institution].filter(Boolean).join(", ")}
                {dateRange ? <Text style={styles.itemSubtitle}>{` · ${dateRange}`}</Text> : null}
              </Text>
            )}
          </View>
        );
      })}
    </>
  );
}

function CertificationsSection({ certifications, template }: { certifications: Certification[]; template: BaseTemplate }) {
  if (!certifications.length) {
    return <Text style={styles.emptyState}>Sin certificaciones registradas.</Text>;
  }
  return (
    <>
      {certifications.map((item, index) => {
        const subtitle = [item.issuer, ...(template === "ats" ? [formatDateRange(item.issueDate, item.expirationDate)] : [])].filter(Boolean).join("  ·  ");
        return (
          <View key={`${item.issuer}-${item.name}-${index}`} style={styles.item}>
            <Text style={styles.itemTitle}>{item.name || "Certificación sin nombre"}</Text>
            {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
          </View>
        );
      })}
    </>
  );
}

export function BaseCvPdfDocument({ cv, template }: { cv: StructuredCv; template: BaseTemplate }) {
  const accent = template === "creative" ? accentStyles : null;
  const contact = [cv.personalInfo.email, cv.personalInfo.phone, cv.personalInfo.location, cv.personalInfo.linkedin, cv.personalInfo.website]
    .filter(Boolean)
    .join("  ·  ");
  const separator = template === "creative" ? " · " : ", ";
  const skills = [...cv.skills.hard, ...cv.skills.soft].join(separator);
  const languages = cv.languages.map((language) => [language.name, language.proficiency].filter(Boolean).join(" - ")).join(separator);
  const experienceSection = (
    <View style={styles.section}>
      <Text style={accent ? [styles.sectionTitle, accent.sectionTitle] : styles.sectionTitle}>
        {template === "creative" ? "Trayectoria" : "Experiencia"}
      </Text>
      <ExperienceSection experience={cv.experience} template={template} />
    </View>
  );
  const educationSection = (
    <View style={styles.section}>
      <Text style={accent ? [styles.sectionTitle, accent.sectionTitle] : styles.sectionTitle}>
        {template === "creative" ? "Formación" : "Educación"}
      </Text>
      <EducationSection education={cv.education} template={template} />
    </View>
  );
  const skillsSection = (
    <View style={styles.section}>
      <Text style={accent ? [styles.sectionTitle, accent.sectionTitle] : styles.sectionTitle}>
        {template === "creative" ? "Competencias" : "Habilidades"}
      </Text>
      <Text style={skills ? styles.inlineList : styles.emptyState}>{skills || "Sin habilidades registradas."}</Text>
    </View>
  );

  return (
    <Document title={cv.personalInfo.fullName || "CV"}>
      <Page size="A4" style={styles.page}>
        {template === "creative" ? (
          <View style={styles.creativeHeader}>
            <View style={cv.personalInfo.photoUrl ? [styles.creativeHeaderText, styles.creativeHeaderTextWithPhoto] : styles.creativeHeaderText}>
              <Text style={styles.eyebrow}>Perfil profesional</Text>
              <Text style={[styles.name, accentStyles.name]}>{cv.personalInfo.fullName || "Nombre profesional"}</Text>
              {contact ? <Text style={styles.contact}>{contact}</Text> : null}
              {cv.summary ? <Text style={styles.summary}>{cv.summary}</Text> : null}
            </View>
            {cv.personalInfo.photoUrl ? <Image src={cv.personalInfo.photoUrl} style={styles.profilePhoto} /> : null}
          </View>
        ) : (
          <>
            <Text style={styles.atsName}>{cv.personalInfo.fullName || "Nombre profesional"}</Text>
            {contact ? <Text style={styles.contact}>{contact}</Text> : null}
            <View style={styles.divider} />
          </>
        )}

        {template === "creative" ? (
          <>{experienceSection}{skillsSection}{educationSection}</>
        ) : (
          <>{experienceSection}{educationSection}{skillsSection}</>
        )}

        <View style={styles.section}>
          <Text style={accent ? [styles.sectionTitle, accent.sectionTitle] : styles.sectionTitle}>Idiomas</Text>
          <Text style={languages ? styles.inlineList : styles.emptyState}>{languages || "Sin idiomas registrados."}</Text>
        </View>

        <View style={styles.section}>
          <Text style={accent ? [styles.sectionTitle, accent.sectionTitle] : styles.sectionTitle}>Certificaciones</Text>
          <CertificationsSection certifications={cv.certifications} template={template} />
        </View>
      </Page>
    </Document>
  );
}
