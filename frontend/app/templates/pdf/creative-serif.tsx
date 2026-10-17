import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StructuredCv } from "../../types/cv";
import {
  Achievements, CREATIVE_TITLES, EMPTY_TEXT, FALLBACK_NAME, certificationMeta, contactItems, educationMeta,
  experienceMeta, joinNonEmpty, languageItems, skillItems,
} from "./shared";

const ACCENT = "#7F1D1D";
const MUTED = "#4B5563";

// Only the built-in Times family: no font files to download or embed.
// Keep letterSpacing modest: wide tracking makes text extraction return "T R A Y E C T O R I A".
const styles = StyleSheet.create({
  page: { paddingHorizontal: 46, paddingVertical: 40, fontSize: 10.5, fontFamily: "Times-Roman", color: "#111827" },
  header: { alignItems: "center", marginBottom: 14 },
  photo: { width: 70, height: 70, borderRadius: 35, objectFit: "cover", marginBottom: 8 },
  name: { fontSize: 26, fontFamily: "Times-Bold", color: ACCENT, textAlign: "center", marginBottom: 3 },
  contact: { fontSize: 9.5, color: MUTED, textAlign: "center", marginBottom: 8 },
  rule: { height: 1, alignSelf: "stretch", backgroundColor: ACCENT, marginBottom: 8 },
  summary: { fontSize: 10.5, fontFamily: "Times-Italic", lineHeight: 1.45, textAlign: "center" },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 11.5, fontFamily: "Times-Bold", color: ACCENT, textTransform: "uppercase", letterSpacing: 0.8, paddingBottom: 2, marginBottom: 6, borderBottomWidth: 0.75, borderBottomColor: ACCENT },
  item: { marginBottom: 7 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  itemTitle: { fontSize: 11, fontFamily: "Times-Bold" },
  date: { fontSize: 10, fontFamily: "Times-Italic", color: MUTED },
  itemSubtitle: { fontSize: 10.5, fontFamily: "Times-Italic", color: MUTED, marginBottom: 1.5 },
  bullet: { fontSize: 10.5, lineHeight: 1.35 },
  inlineList: { fontSize: 10.5, lineHeight: 1.4 },
  emptyState: { fontSize: 10, color: MUTED, fontFamily: "Times-Italic" },
});

export function SerifCvPdfDocument({ cv }: { cv: StructuredCv }) {
  const contact = joinNonEmpty(contactItems(cv), "  |  ");
  const skills = skillItems(cv).join(", ");
  const languages = languageItems(cv).join(", ");
  return (
    <Document title={cv.personalInfo.fullName || "CV"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {cv.personalInfo.photoUrl ? <Image src={cv.personalInfo.photoUrl} style={styles.photo} /> : null}
          <Text style={styles.name}>{cv.personalInfo.fullName || FALLBACK_NAME}</Text>
          {contact ? <Text style={styles.contact}>{contact}</Text> : null}
          <View style={styles.rule} />
          {cv.summary ? <Text style={styles.summary}>{cv.summary}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CREATIVE_TITLES.experience}</Text>
          {cv.experience.length ? cv.experience.map((item, index) => {
            const { title, subtitle, dateRange } = experienceMeta(item);
            return (
              <View key={`${item.company}-${item.title}-${index}`} style={styles.item} wrap={false}>
                <View style={styles.heading}>
                  <Text style={styles.itemTitle}>{title}</Text>
                  {dateRange ? <Text style={styles.date}>{dateRange}</Text> : null}
                </View>
                {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
                <Achievements items={item.achievements} textStyle={styles.bullet} />
              </View>
            );
          }) : <Text style={styles.emptyState}>{EMPTY_TEXT.experience}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CREATIVE_TITLES.education}</Text>
          {cv.education.length ? cv.education.map((item, index) => {
            const { title, dateRange } = educationMeta(item);
            return (
              <View key={`${item.institution}-${item.program}-${index}`} style={[styles.item, styles.heading]} wrap={false}>
                <Text style={styles.itemTitle}>{title}</Text>
                {dateRange ? <Text style={styles.date}>{dateRange}</Text> : null}
              </View>
            );
          }) : <Text style={styles.emptyState}>{EMPTY_TEXT.education}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CREATIVE_TITLES.skills}</Text>
          <Text style={skills ? styles.inlineList : styles.emptyState}>{skills || EMPTY_TEXT.skills}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CREATIVE_TITLES.languages}</Text>
          <Text style={languages ? styles.inlineList : styles.emptyState}>{languages || EMPTY_TEXT.languages}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CREATIVE_TITLES.certifications}</Text>
          {cv.certifications.length ? cv.certifications.map((item, index) => {
            const { title, issuer } = certificationMeta(item);
            return (
              <View key={`${item.issuer}-${item.name}-${index}`} style={styles.item} wrap={false}>
                <Text style={styles.itemTitle}>{title}</Text>
                {issuer ? <Text style={styles.itemSubtitle}>{issuer}</Text> : null}
              </View>
            );
          }) : <Text style={styles.emptyState}>{EMPTY_TEXT.certifications}</Text>}
        </View>
      </Page>
    </Document>
  );
}
