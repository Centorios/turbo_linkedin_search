import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StructuredCv } from "../../types/cv";
import {
  Achievements, CREATIVE_TITLES, EMPTY_TEXT, FALLBACK_NAME, certificationMeta, contactItems, educationMeta,
  experienceMeta, joinNonEmpty, languageItems, skillItems,
} from "./shared";

const ACCENT = "#0E7490";
const RAIL = "#A5F3FC";
const MUTED = "#475569";
const CONTENT_WIDTH = 595 - 80; // A4 minus 40pt side padding
const PHOTO_SIZE = 70;
const PHOTO_GAP = 14;
const DATE_WIDTH = 78;
const RAIL_WIDTH = 12;

const styles = StyleSheet.create({
  page: { paddingHorizontal: 40, paddingVertical: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  header: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 10, marginBottom: 14, borderBottomWidth: 3, borderBottomColor: ACCENT },
  headerText: { flexGrow: 1, flexShrink: 1 },
  // Text does not wrap to the room left by the photo unless it has an explicit width.
  headerTextWithPhoto: { width: CONTENT_WIDTH - PHOTO_SIZE - PHOTO_GAP },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2, objectFit: "cover", marginLeft: PHOTO_GAP, flexShrink: 0 },
  eyebrow: { fontSize: 8, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  contact: { fontSize: 9, color: MUTED, marginBottom: 6 },
  summary: { fontSize: 10, lineHeight: 1.45 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: ACCENT, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  row: { flexDirection: "row" },
  dateColumn: { width: DATE_WIDTH, flexShrink: 0, paddingRight: 10, alignItems: "flex-end" },
  date: { fontSize: 8.5, color: ACCENT, fontFamily: "Helvetica-Bold", textAlign: "right" },
  railColumn: { width: RAIL_WIDTH, flexShrink: 0, alignItems: "center" },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: ACCENT },
  rail: { width: 1.5, flexGrow: 1, backgroundColor: RAIL, marginTop: 2 },
  content: { width: CONTENT_WIDTH - DATE_WIDTH - RAIL_WIDTH, flexShrink: 0, paddingLeft: 10 },
  itemTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  itemSubtitle: { fontSize: 9, color: MUTED, marginBottom: 1 },
  bullet: { fontSize: 9.5, lineHeight: 1.35 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: { fontSize: 9, paddingHorizontal: 7, paddingVertical: 2.5, marginRight: 5, marginBottom: 5, borderWidth: 1, borderColor: RAIL, borderRadius: 8, backgroundColor: "#ECFEFF" },
  plainItem: { marginBottom: 6 },
  emptyState: { fontSize: 9, color: MUTED, fontStyle: "italic" },
});

function TimelineItem({ date, isLast, children }: { date: string; isLast: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.row} wrap={false}>
      <View style={styles.dateColumn}>{date ? <Text style={styles.date}>{date}</Text> : null}</View>
      <View style={styles.railColumn}>
        <View style={styles.dot} />
        {!isLast ? <View style={styles.rail} /> : null}
      </View>
      <View style={[styles.content, { paddingBottom: isLast ? 0 : 12 }]}>{children}</View>
    </View>
  );
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <Text style={styles.emptyState}>{empty}</Text>;
  return (
    <View style={styles.chips}>
      {items.map((item, index) => <Text key={`${index}-${item}`} style={styles.chip}>{item}</Text>)}
    </View>
  );
}

export function TimelineCvPdfDocument({ cv }: { cv: StructuredCv }) {
  const contact = joinNonEmpty(contactItems(cv), "  |  ");
  return (
    <Document title={cv.personalInfo.fullName || "CV"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={cv.personalInfo.photoUrl ? [styles.headerText, styles.headerTextWithPhoto] : styles.headerText}>
            <Text style={styles.eyebrow}>{CREATIVE_TITLES.eyebrow}</Text>
            <Text style={styles.name}>{cv.personalInfo.fullName || FALLBACK_NAME}</Text>
            {contact ? <Text style={styles.contact}>{contact}</Text> : null}
            {cv.summary ? <Text style={styles.summary}>{cv.summary}</Text> : null}
          </View>
          {cv.personalInfo.photoUrl ? <Image src={cv.personalInfo.photoUrl} style={styles.photo} /> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CREATIVE_TITLES.experience}</Text>
          {cv.experience.length ? cv.experience.map((item, index) => {
            const { title, subtitle, dateRange } = experienceMeta(item);
            return (
              <TimelineItem key={`${item.company}-${item.title}-${index}`} date={dateRange} isLast={index === cv.experience.length - 1}>
                <Text style={styles.itemTitle}>{title}</Text>
                {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
                <Achievements items={item.achievements} textStyle={styles.bullet} />
              </TimelineItem>
            );
          }) : <Text style={styles.emptyState}>{EMPTY_TEXT.experience}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CREATIVE_TITLES.education}</Text>
          {cv.education.length ? cv.education.map((item, index) => {
            const { title, dateRange } = educationMeta(item);
            return (
              <TimelineItem key={`${item.institution}-${item.program}-${index}`} date={dateRange} isLast={index === cv.education.length - 1}>
                <Text style={styles.itemTitle}>{title}</Text>
              </TimelineItem>
            );
          }) : <Text style={styles.emptyState}>{EMPTY_TEXT.education}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CREATIVE_TITLES.skills}</Text>
          <Chips items={skillItems(cv)} empty={EMPTY_TEXT.skills} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CREATIVE_TITLES.languages}</Text>
          <Chips items={languageItems(cv)} empty={EMPTY_TEXT.languages} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CREATIVE_TITLES.certifications}</Text>
          {cv.certifications.length ? cv.certifications.map((item, index) => {
            const { title, issuer } = certificationMeta(item);
            return (
              <View key={`${item.issuer}-${item.name}-${index}`} style={styles.plainItem} wrap={false}>
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
