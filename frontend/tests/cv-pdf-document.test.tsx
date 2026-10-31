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
import { CREATIVE_STYLES, CV_TEMPLATES, templateFileSuffix, type CvTemplate } from "../app/templates/registry";
import type { StructuredCv } from "../app/types/cv";

const TEMPLATES: readonly CvTemplate[] = CV_TEMPLATES;
const ORDERED_TEMPLATES: CvTemplate[] = ["ats", "creative"];
const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? []).length;
}

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

async function renderPdfBytes(cv: StructuredCv, template: CvTemplate): Promise<Buffer> {
  const stream = (await ReactPDF.pdf(<CvPdfDocument cv={cv} template={template} />).toBuffer()) as unknown as AsyncIterable<Buffer>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  return buffer;
}

async function renderText(cv: StructuredCv, template: CvTemplate): Promise<string> {
  const parser = new PDFParse({ data: await renderPdfBytes(cv, template) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function expectContentInOrder(text: string, entries: string[]) {
  let previousIndex = -1;
  for (const entry of entries) {
    const index = text.indexOf(entry.toLocaleLowerCase(), previousIndex + 1);
    expect(index, `Expected '${entry}' after index ${previousIndex}`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

it.each(["ats", "creative"] as const)("incluye una credencial elegida una sola vez en %s", async (template) => {
  const cv = emptyCv();
  cv.certifications = [{ name: "Certificado Python Avanzado", issuer: "Academia", issueDate: "2025", expirationDate: "", credential: "PY-01" }];
  const text = (await renderText(cv, template)).toLocaleLowerCase();
  expect(text.match(/certificado python avanzado/g)).toHaveLength(1);
});

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

      expect(text).toContain(template === "ats" ? "NOMBRE PROFESIONAL" : "Nombre profesional");
      // No contact details means no "·" separators should appear before the section headers.
      expect(text.split("\n")[1]).not.toContain("·");
    });

    it('omits the summary paragraph when summary is ""', async () => {
      const cv: StructuredCv = { ...emptyCv(), personalInfo: { ...emptyCv().personalInfo, fullName: "Ana García" } };
      const text = await renderText(cv, template);

      expect(text).not.toContain("Product designer con experiencia en productos digitales.");
      expect(text).not.toContain("RESUMEN");
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
      // Nothing should trail the start date (no "-" for the missing end date), whatever the layout.
      expect(text).not.toMatch(/03-2021\s*[-–—]/);
    });

    it("renders certification fields visible in the selected preview", async () => {
      const cv: StructuredCv = {
        ...emptyCv(),
        certifications: [
          { name: "AWS Cloud Practitioner", issuer: "AWS", issueDate: "2023", expirationDate: "2026", credential: "ABC123" },
        ],
      };
      const text = await renderText(cv, template);

      expect(text).toContain("AWS Cloud Practitioner");
      expect(text).toContain("AWS");
      if (template === "ats") {
        expect(text).toContain("2023 - 2026");
      } else {
        expect(text).not.toContain("2023 - 2026");
      }
      expect(text).not.toContain("ABC123");
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
    expect(buildCvFileName(cv, "creative-sidebar")).toBe("ana-garcia-creativo-barra-lateral.pdf");
    expect(buildCvFileName(cv, "creative-banner")).toBe("ana-garcia-creativo-encabezado.pdf");
    expect(buildCvFileName(cv, "creative-serif")).toBe("ana-garcia-creativo-serif.pdf");
    expect(buildCvFileName(cv, "creative-timeline")).toBe("ana-garcia-creativo-linea-de-tiempo.pdf");
    const names = TEMPLATES.map((template) => buildCvFileName(cv, template));
    expect(new Set(names).size).toBe(TEMPLATES.length);
  });
});

describe("Foto de perfil en PDF", () => {
  const cvWithPhoto: StructuredCv = {
    ...emptyCv(),
    personalInfo: { ...emptyCv().personalInfo, fullName: "Ana García", photoUrl: PHOTO },
  };

  it.each(CREATIVE_STYLES.map((style) => style.id))("incluye la foto en el estilo creativo %s", async (template) => {
    expect((await renderPdfBytes(cvWithPhoto, template)).toString("latin1")).toContain("/Subtype /Image");
  });

  it("omite la foto en ATS", async () => {
    expect((await renderPdfBytes(cvWithPhoto, "ats")).toString("latin1")).not.toContain("/Subtype /Image");
  });

  it.each(CREATIVE_STYLES.map((style) => style.id))("no incluye imagen en %s si no hay foto", async (template) => {
    expect((await renderPdfBytes(emptyCv(), template)).toString("latin1")).not.toContain("/Subtype /Image");
  });
});

describe("Contenido y orden del PDF", () => {
  it.each(ORDERED_TEMPLATES)("mantiene contenido y orden de la plantilla %s", async (template) => {
    const cv: StructuredCv = {
      personalInfo: { fullName: "Ana García", email: "ana@example.com", phone: "600 123 456", location: "Madrid", linkedin: "", website: "" },
      summary: "Product designer con experiencia en productos digitales.",
      experience: [
        { title: "Senior Designer", company: "Acme", location: "Remoto", startDate: "03-2021", endDate: "", achievements: ["Lideró el rediseño del checkout"] },
      ],
      education: [{ institution: "UBA", program: "Diseño Gráfico", startDate: "2015", endDate: "2019", description: "" }],
      skills: { hard: ["Figma"], soft: ["Comunicación"] },
      languages: [{ name: "Español", proficiency: "Nativo" }],
      certifications: [{ name: "AWS Cloud Practitioner", issuer: "AWS", issueDate: "2023", expirationDate: "2026", credential: "NO-MOSTRAR" }],
    };
    const pdfText = (await renderText(cv, template)).replace(/\s+/g, " ").toLocaleLowerCase();
    const orderedEntries = template === "ats"
      ? ["ana garcía", "ana@example.com", "experiencia", "senior designer", "acme", "lideró el rediseño", "educación", "diseño gráfico", "habilidades", "figma", "idiomas", "español", "certificaciones", "aws cloud"]
      : ["perfil profesional", "ana garcía", "ana@example.com", "product designer", "trayectoria", "senior designer", "acme", "lideró el rediseño", "competencias", "figma", "formación", "diseño gráfico", "idiomas", "español", "certificaciones", "aws cloud"];

    expectContentInOrder(pdfText, orderedEntries);
    expect(pdfText.includes("product designer con experiencia en productos digitales.")).toBe(template === "creative");
    expect(pdfText).not.toContain("no-mostrar");
  });
});

describe("Estilos creativos", () => {
  const fullCv: StructuredCv = {
    personalInfo: { fullName: "Ana García", email: "ana@example.com", phone: "600 123 456", location: "Madrid", linkedin: "", website: "" },
    summary: "Product designer con experiencia en productos digitales.",
    experience: [
      { title: "Senior Designer", company: "Acme", location: "Remoto", startDate: "03-2021", endDate: "", achievements: ["Lideró el rediseño del checkout"] },
    ],
    education: [{ institution: "UBA", program: "Diseño Gráfico", startDate: "2015", endDate: "2019", description: "" }],
    skills: { hard: ["Figma"], soft: ["Comunicación"] },
    languages: [{ name: "Español", proficiency: "Nativo" }],
    certifications: [{ name: "AWS Cloud Practitioner", issuer: "AWS", issueDate: "2023", expirationDate: "2026", credential: "NO-MOSTRAR" }],
  };

  // Two-column layouts extract in a different reading order, so only presence is checked here.
  it.each(CREATIVE_STYLES.map((style) => style.id))("el estilo %s muestra todo el contenido y nada más", async (template) => {
    const text = (await renderText(fullCv, template)).replace(/\s+/g, " ").toLocaleLowerCase();
    // The formal serif header intentionally has no "Perfil profesional" label.
    const labels = template === "creative-serif" ? [] : ["perfil profesional"];
    for (const entry of [
      ...labels, "ana garcía", "ana@example.com", "product designer con experiencia", "trayectoria", "senior designer",
      "acme", "lideró el rediseño", "formación", "diseño gráfico", "uba", "competencias", "figma", "comunicación", "idiomas",
      "español - nativo", "certificaciones", "aws cloud practitioner",
    ]) {
      expect(text, `Falta '${entry}'`).toContain(entry);
    }
    expect(text).not.toContain("no-mostrar");
    expect(text).not.toContain("2023 - 2026");
  });

  it("cada estilo creativo genera un PDF distinto", async () => {
    const outputs = await Promise.all(CREATIVE_STYLES.map(async (style) => (await renderPdfBytes(fullCv, style.id)).toString("latin1")));
    expect(new Set(outputs).size).toBe(CREATIVE_STYLES.length);
  });

  it.each(["creative-sidebar", "creative-timeline", "creative-banner", "creative-serif"] as const)(
    "un CV largo ocupa varias páginas en %s sin perder contenido", async (template) => {
      const longCv: StructuredCv = {
        ...fullCv,
        experience: Array.from({ length: 14 }, (_, index) => ({
          title: `Cargo ${index + 1}`, company: `Empresa ${index + 1}`, location: "Madrid", startDate: "2020", endDate: "2021",
          achievements: ["Logro con resultados medibles en el área", "Otro logro asociado a un proyecto estratégico"],
        })),
      };
      const pdf = await renderPdfBytes(longCv, template);
      expect(pageCount(pdf)).toBeGreaterThan(1);
      const parser = new PDFParse({ data: pdf });
      try {
        const text = (await parser.getText()).text;
        expect(text).toContain("Cargo 1");
        expect(text).toContain("Cargo 14");
        expect(text).toContain("Certificaciones".toUpperCase());
      } finally {
        await parser.destroy();
      }
    },
  );

  it("el registro mantiene los ids y los nombres de archivo únicos", () => {
    const ids = CREATIVE_STYLES.map((style) => style.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(CREATIVE_STYLES.map((style) => style.fileSuffix)).size).toBe(ids.length);
    expect(templateFileSuffix("ats")).toBe("ats");
    expect(CV_TEMPLATES).toEqual(["ats", ...ids]);
  });
});
