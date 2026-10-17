import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StructuredCv } from "../../types/cv";
import {
  Achievements, CREATIVE_TITLES, EMPTY_TEXT, FALLBACK_NAME, certificationMeta, contactItems, educationMeta,
  experienceMeta, joinNonEmpty, languageItems, skillItems,
} from "./shared";

const BANNER_BG = "#115E59";
const ACCENT = "#0F766E";
const MUTED = "#475569";
const PAGE_PADDING = 32;
const CONTENT_WIDTH = 595 - 80; // A4 minus 40pt side padding
const PHOTO_SIZE = 80;
const PHOTO_GAP = 16;
const SIDE_WIDTH = 168;

const styles = StyleSheet.create({
  page: { paddingVertical: PAGE_PADDING, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  // Negative margin pulls the banner over the page padding so it bleeds to the top edge.
  banner: { marginTop: -PAGE_PADDING, paddingTop: PAGE_PADDING + 6, paddingBottom: 20, paddingHorizontal: 40, backgroundColor: BANNER_BG, flexDirection: "row", alignItems: "center" },
  bannerText: { flexGrow: 1, flexShrink: 1 },
  // Text does not wrap to the room left by the photo unless it has an explicit width.
  bannerTextWithPhoto: { width: CONTENT_WIDTH - PHOTO_SIZE - PHOTO_GAP },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2, objectFit: "cover", marginLeft: PHOTO_GAP, flexShrink: 0 },
  eyebrow: { fontSize: 8, color: "#99F6E4", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  name: { fontSize: 24, fontFamily: "Helvetica-Bold", color: "#FFFFFF", marginBottom: 4 },
  contact: { fontSize: 9, color: "#CCFBF1" },
  summary: { fontSize: 10, lineHeight: 1.45, color: "#F0FDFA", marginTop: 8 },
  columns: { flexDirection: "row", paddingHorizontal: 40, paddingTop: 18 },
  main: { width: CONTENT_WIDTH - SIDE_WIDTH, flexShrink: 0, paddingRight: 22 },
  side: { width: SIDE_WIDTH, flexShrink: 0, paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: "#99F6E4" },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: ACCENT, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  section: { marginBottom: 14 },
  item: { marginBottom: 8 },
  itemTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  itemSubtitle: { fontSize: 9, color: MUTED, marginBottom: 1 },
  bullet: { fontSize: 9.5, lineHeight: 1.35 },
  sideText: { fontSize: 9.5, lineHeight: 1.4, marginBottom: 2 },
  emptyState: { fontSize: 9, color: MUTED, fontStyle: "italic" },
});

function SideList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length ? items.map((item, index) => <Text key={`${index}-${item}`} style={styles.sideText}>{item}</Text>) : <Text style={styles.emptyState}>{empty}</Text>}
    </View>
  );
}

export function BannerCvPdfDocument({ cv }: { cv: StructuredCv }) {
  const contact = joinNonEmpty(contactItems(cv), "  |  ");
  return (
    <Document title={cv.personalInfo.fullName || "CV"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.banner}>
          <View style={cv.personalInfo.photoUrl ? [styles.bannerText, styles.bannerTextWithPhoto] : styles.bannerText}>
            <Text style={styles.eyebrow}>{CREATIVE_TITLES.eyebrow}</Text>
            <Text style={styles.name}>{cv.personalInfo.fullName || FALLBACK_NAME}</Text>
            {contact ? <Text style={styles.contact}>{contact}</Text> : null}
            {cv.summary ? <Text style={styles.summary}>{cv.summary}</Text> : null}
          </View>
          {cv.personalInfo.photoUrl ? <Image src={cv.personalInfo.photoUrl} style={styles.photo} /> : null}
        </View>

        <View style={styles.columns}>
          <View style={styles.main}>
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
          </View>

          <View style={styles.side}>
            <SideList title={CREATIVE_TITLES.skills} items={skillItems(cv)} empty={EMPTY_TEXT.skills} />
            <SideList title={CREATIVE_TITLES.languages} items={languageItems(cv)} empty={EMPTY_TEXT.languages} />
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
