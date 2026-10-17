import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StructuredCv } from "../../types/cv";
import {
  Achievements, CREATIVE_TITLES, EMPTY_TEXT, FALLBACK_NAME, certificationMeta, contactItems, educationMeta,
  experienceMeta, languageItems, skillItems,
} from "./shared";

const A4_WIDTH = 595;
const SIDEBAR_WIDTH = 190;
const SIDEBAR_BG = "#1E293B";
const SIDEBAR_TEXT = "#E2E8F0";
const SIDEBAR_HEADING = "#7DD3FC";
const ACCENT = "#0EA5E9";
const MUTED = "#475569";

const styles = StyleSheet.create({
  page: { paddingVertical: 32, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  sidebarBackground: { position: "absolute", top: 0, bottom: 0, left: 0, width: SIDEBAR_WIDTH, backgroundColor: SIDEBAR_BG },
  columns: { flexDirection: "row" },
  sidebar: { width: SIDEBAR_WIDTH, flexShrink: 0, paddingHorizontal: 18 },
  // Explicit width so text wraps inside the column instead of running off the page.
  main: { width: A4_WIDTH - SIDEBAR_WIDTH, flexShrink: 0, paddingLeft: 26, paddingRight: 34 },
  photo: { width: 86, height: 86, borderRadius: 43, objectFit: "cover", marginBottom: 16 },
  sidebarTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: SIDEBAR_HEADING, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  sidebarText: { fontSize: 9, color: SIDEBAR_TEXT, lineHeight: 1.35, marginBottom: 2 },
  sidebarEmpty: { fontSize: 9, color: SIDEBAR_TEXT, fontStyle: "italic" },
  sidebarSection: { marginBottom: 16 },
  eyebrow: { fontSize: 8, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  name: { fontSize: 24, fontFamily: "Helvetica-Bold", color: SIDEBAR_BG, marginBottom: 6 },
  summary: { fontSize: 10, lineHeight: 1.45, marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: SIDEBAR_BG, textTransform: "uppercase", letterSpacing: 0.6, paddingBottom: 3, marginBottom: 7, borderBottomWidth: 1.5, borderBottomColor: ACCENT },
  section: { marginBottom: 14 },
  item: { marginBottom: 8 },
  itemTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  itemSubtitle: { fontSize: 9, color: MUTED, marginBottom: 1 },
  bullet: { fontSize: 9.5, lineHeight: 1.35 },
  emptyState: { fontSize: 9, color: MUTED, fontStyle: "italic" },
});

function SidebarList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <View style={styles.sidebarSection}>
      <Text style={styles.sidebarTitle}>{title}</Text>
      {items.length ? items.map((item, index) => <Text key={`${index}-${item}`} style={styles.sidebarText}>{item}</Text>) : <Text style={styles.sidebarEmpty}>{empty}</Text>}
    </View>
  );
}

export function SidebarCvPdfDocument({ cv }: { cv: StructuredCv }) {
  const contact = contactItems(cv);
  return (
    <Document title={cv.personalInfo.fullName || "CV"}>
      <Page size="A4" style={styles.page}>
        {/* Repeated on every page so the colored column survives page breaks. */}
        <View fixed style={styles.sidebarBackground} />
        <View style={styles.columns}>
          <View style={styles.sidebar}>
            {cv.personalInfo.photoUrl ? <Image src={cv.personalInfo.photoUrl} style={styles.photo} /> : null}
            {contact.length ? (
              <View style={styles.sidebarSection}>
                <Text style={styles.sidebarTitle}>Contacto</Text>
                {contact.map((item, index) => <Text key={`${index}-${item}`} style={styles.sidebarText}>{item}</Text>)}
              </View>
            ) : null}
            <SidebarList title={CREATIVE_TITLES.skills} items={skillItems(cv)} empty={EMPTY_TEXT.skills} />
            <SidebarList title={CREATIVE_TITLES.languages} items={languageItems(cv)} empty={EMPTY_TEXT.languages} />
          </View>

          <View style={styles.main}>
            <Text style={styles.eyebrow}>{CREATIVE_TITLES.eyebrow}</Text>
            <Text style={styles.name}>{cv.personalInfo.fullName || FALLBACK_NAME}</Text>
            {cv.summary ? <Text style={styles.summary}>{cv.summary}</Text> : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{CREATIVE_TITLES.experience}</Text>
              {cv.experience.length ? cv.experience.map((item, index) => {
                const { title, subtitle, dateRange } = experienceMeta(item);
                return (
                  <View key={`${item.company}-${item.title}-${index}`} style={styles.item} wrap={false}>
                    <Text style={styles.itemTitle}>{title}</Text>
                    {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
                    {dateRange ? <Text style={styles.itemSubtitle}>{dateRange}</Text> : null}
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
                  <View key={`${item.institution}-${item.program}-${index}`} style={styles.item} wrap={false}>
                    <Text style={styles.itemTitle}>{title}</Text>
                    {dateRange ? <Text style={styles.itemSubtitle}>{dateRange}</Text> : null}
                  </View>
                );
              }) : <Text style={styles.emptyState}>{EMPTY_TEXT.education}</Text>}
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
          </View>
        </View>
      </Page>
    </Document>
  );
}
