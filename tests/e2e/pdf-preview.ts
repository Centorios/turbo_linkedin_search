import { expect, type Page } from "@playwright/test";
import { PDFParse } from "pdf-parse";

// The CV preview is the real PDF (a blob URL), so assertions read the PDF
// bytes instead of DOM text.

export async function readPreviewPdf(page: Page): Promise<Buffer> {
  // The "open" link is always rendered (headless Chromium has no PDF viewer,
  // so the iframe itself is not) and points to the same blob.
  const link = page.getByTestId("cv-preview-open");
  await expect(link).toBeVisible();
  const src = await link.getAttribute("href");
  expect(src).toMatch(/^blob:/);
  const bytes = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return Array.from(new Uint8Array(await response.arrayBuffer()));
  }, src!.split("#")[0]);
  return Buffer.from(bytes);
}

export async function pdfText(bytes: Buffer): Promise<string> {
  const parser = new PDFParse({ data: bytes });
  try {
    return (await parser.getText()).text.replace(/\s+/g, " ").toLocaleLowerCase();
  } finally {
    await parser.destroy();
  }
}

export async function readPreviewText(page: Page): Promise<string> {
  return pdfText(await readPreviewPdf(page));
}

export function pdfHasImage(bytes: Buffer): boolean {
  return bytes.includes("/Subtype /Image");
}

// Polls because changing template or CV re-renders the preview PDF.
export async function expectPreviewText(page: Page, { contains = [], excludes = [] }: { contains?: string[]; excludes?: string[] }) {
  await expect.poll(async () => {
    const text = await readPreviewText(page);
    return contains.every((entry) => text.includes(entry.toLocaleLowerCase()))
      && excludes.every((entry) => !text.includes(entry.toLocaleLowerCase()));
  }, { message: `Vista previa con ${JSON.stringify(contains)} y sin ${JSON.stringify(excludes)}` }).toBe(true);
}
