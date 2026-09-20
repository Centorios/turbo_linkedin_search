// @vitest-environment node
//
// Renders through the real @react-pdf/renderer pipeline, which produces
// binary PDF bytes. That corrupts under Vitest's default jsdom environment
// (an unrelated jsdom + Node binary-stream interaction), so this file opts
// into the plain Node environment instead.
import { describe, expect, it } from "vitest";
import ReactPDF from "@react-pdf/renderer";
import { PDFParse } from "pdf-parse";
import { buildCvFileName, CvPdfDocument } from "../app/templates/cv-pdf-document";
import type { CvTemplate } from "../app/components/cv-preview";
import type { StructuredCv } from "../app/types/cv";

const TEMPLATES: CvTemplate[] = ["ats", "creative"];

function emptyCv(): StructuredCv {
  return {
    personalInfo: { fullName: "", email: "", phone: "", location: "", linkedin: "", website: "" },
    summary: "",
    experience: [],
    education: [],
    skills: { hard: [], soft: [] },
    languages: [],
    certifications: [],
  };
}

async function renderText(cv: StructuredCv, template: CvTemplate): Promise<string> {
  const stream = (await ReactPDF.pdf(<CvPdfDocument cv={cv} template={template} />).toBuffer()) as unknown as AsyncIterable<Buffer>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

describe("CvPdfDocument", () => {
  describe.each(TEMPLATES)('template="%s"', (template) => {
    it("renders every empty-state fallback when all arrays are empty", async () => {
      const text = await renderText(emptyCv(), template);

      expect(text).toContain("Sin experiencia registrada.");
      expect(text).toContain("Sin educación registrada.");
      expect(text).toContain("Sin habilidades registradas.");
      expect(text).toContain("Sin idiomas registrados.");
      expect(text).toContain("Sin certificaciones registradas.");
    });

    it("stays legible with only a single populated section", async () => {
      const cv: StructuredCv = { ...emptyCv(), skills: { hard: ["Figma"], soft: [] } };
      const text = await renderText(cv, template);

      expect(text).toContain("Figma");
      expect(text).toContain("Sin experiencia registrada.");
      expect(text).toContain("Sin certificaciones registradas.");
    });

    it('falls back to a placeholder name and omits the contact line when personalInfo fields are ""', async () => {
      const text = await renderText(emptyCv(), template);

      expect(text).toContain("Nombre profesional");
      // No contact details means no "·" separators should appear before the section headers.
      expect(text.split("\n")[1]).not.toContain("·");
    });

    it('omits the summary paragraph when summary is ""', async () => {
      const cv: StructuredCv = { ...emptyCv(), personalInfo: { ...emptyCv().personalInfo, fullName: "Ana García" } };
      const text = await renderText(cv, template);

      const nameIndex = text.indexOf("Ana García");
      const experienceIndex = text.indexOf("EXPERIENCIA");
      // Nothing but the section header should sit between the name and the first section.
      expect(text.slice(nameIndex + "Ana García".length, experienceIndex).trim()).toBe("");
    });

    it("renders a YYYY-only date range joined with a dash", async () => {
      const cv: StructuredCv = {
        ...emptyCv(),
        education: [{ institution: "UBA", program: "Diseño Gráfico", startDate: "2015", endDate: "2019", description: "" }],
      };
      const text = await renderText(cv, template);

      expect(text).toContain("UBA");
      expect(text).toContain("2015 - 2019");
    });

    it("renders an MM-YYYY date range and an open-ended (empty end date) entry without a dangling separator", async () => {
      const cv: StructuredCv = {
        ...emptyCv(),
        experience: [
          { title: "Senior Designer", company: "Acme", location: "Remoto", startDate: "03-2021", endDate: "", achievements: [] },
        ],
      };
      const text = await renderText(cv, template);

      expect(text).toContain("Acme");
      expect(text).toContain("03-2021");
      // Nothing should trail the start date on its line (no "-" for the missing end date).
      const subtitleLine = text.split("\n").find((line) => line.includes("03-2021"));
      expect(subtitleLine?.trim().endsWith("03-2021")).toBe(true);
    });

    it("renders certifications with every field populated", async () => {
      const cv: StructuredCv = {
        ...emptyCv(),
        certifications: [
          { name: "AWS Cloud Practitioner", issuer: "AWS", issueDate: "2023", expirationDate: "2026", credential: "ABC123" },
        ],
      };
      const text = await renderText(cv, template);

      expect(text).toContain("AWS Cloud Practitioner");
      expect(text).toContain("AWS");
      expect(text).toContain("2023 - 2026");
      expect(text).toContain("ABC123");
    });

    it("renders a certification with only its name without crashing", async () => {
      const cv: StructuredCv = {
        ...emptyCv(),
        certifications: [{ name: "Certificación sin detalles", issuer: "", issueDate: "", expirationDate: "", credential: "" }],
      };
      const text = await renderText(cv, template);

      expect(text).toContain("Certificación sin detalles");
    });

    it("renders multiple experience achievements as separate bullets", async () => {
      const cv: StructuredCv = {
        ...emptyCv(),
        experience: [
          {
            title: "Senior Designer",
            company: "Acme",
            location: "",
            startDate: "",
            endDate: "",
            achievements: ["Lideró el rediseño del checkout", "Mentoreó a dos diseñadores junior"],
          },
        ],
      };
      const text = await renderText(cv, template);

      expect(text).toContain("Lideró el rediseño del checkout");
      expect(text).toContain("Mentoreó a dos diseñadores junior");
    });
  });
});

describe("buildCvFileName", () => {
  it("falls back to a generic name when fullName is empty", () => {
    expect(buildCvFileName(emptyCv(), "ats")).toBe("cv-ats.pdf");
  });

  it("slugifies accents, casing and spaces", () => {
    const cv: StructuredCv = { ...emptyCv(), personalInfo: { ...emptyCv().personalInfo, fullName: "Ana García Núñez" } };
    expect(buildCvFileName(cv, "creative")).toBe("ana-garcia-nunez-creativo.pdf");
  });

  it("uses a different suffix per template for the same CV", () => {
    const cv: StructuredCv = { ...emptyCv(), personalInfo: { ...emptyCv().personalInfo, fullName: "Ana García" } };
    expect(buildCvFileName(cv, "ats")).toBe("ana-garcia-ats.pdf");
    expect(buildCvFileName(cv, "creative")).toBe("ana-garcia-creativo.pdf");
  });
});
