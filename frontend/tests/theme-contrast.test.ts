import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Reads the real tokens from globals.css, so changing a color there is checked here.
const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

function block(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `No se encontró ${selector}`).toBeGreaterThan(-1);
  return css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
}

function tokens(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of source.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) result[match[1]] = match[2];
  return result;
}

const light = tokens(block("@theme"));
const dark = { ...light, ...tokens(block(':root[data-theme="dark"]')) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255).map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// [foreground token, background token]
const TEXT_PAIRS: [string, string][] = [
  ["text", "surface"], ["text", "subtle"], ["text", "canvas"],
  ["text-muted", "surface"], ["text-muted", "subtle"], ["text-muted", "canvas"],
  ["text-faint", "surface"], ["text-faint", "subtle"], ["text-faint", "canvas"],
  ["primary", "surface"], ["primary", "primary-surface"],
  ["on-primary", "primary"], ["on-primary", "danger"],
  ["success", "success-surface"], ["warning", "warning-surface"], ["danger", "danger-surface"], ["danger", "surface"],
];

// Pairs of the original light palette that were already below 4.5:1 before the
// dark theme existed. They are kept as they are (the light colors are not part of
// this change) but listed here so they stay visible, and cannot get worse.
const KNOWN_LIGHT_GAPS = new Map<string, number>([
  ["text-faint/subtle", 4.2],
  ["text-faint/canvas", 4.2],
  ["success/success-surface", 3.5],
  ["warning/warning-surface", 3.0],
  ["danger/danger-surface", 4.4],
]);

describe("Contraste de los temas (WCAG AA)", () => {
  it("lee los tokens de los dos temas", () => {
    expect(Object.keys(light).length).toBeGreaterThan(10);
    for (const name of ["canvas", "surface", "text", "primary", "primary-surface"]) {
      expect(light[name], `claro: ${name}`).toBeTruthy();
      expect(dark[name], `oscuro: ${name}`).toBeTruthy();
    }
    expect(dark.surface).not.toBe(light.surface);
  });

  it.each(TEXT_PAIRS)("oscuro: %s sobre %s llega a 4.5:1", (foreground, background) => {
    expect(contrast(dark[foreground], dark[background]), `${foreground}/${background}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TEXT_PAIRS)("claro: %s sobre %s llega a 4.5:1 (o no empeora un caso conocido)", (foreground, background) => {
    const ratio = contrast(light[foreground], light[background]);
    const knownMinimum = KNOWN_LIGHT_GAPS.get(`${foreground}/${background}`);
    if (knownMinimum === undefined) expect(ratio).toBeGreaterThanOrEqual(4.5);
    else expect(ratio).toBeGreaterThanOrEqual(knownMinimum);
  });

  it("el oscuro es de verdad oscuro: el fondo es más oscuro que el texto", () => {
    expect(luminance(dark.canvas)).toBeLessThan(0.05);
    expect(luminance(dark.surface)).toBeLessThan(luminance(dark.text));
    expect(luminance(dark.canvas)).toBeLessThanOrEqual(luminance(dark.surface));
  });

  it("los bordes se distinguen del fondo en los dos temas", () => {
    expect(contrast(light.border, light.surface)).toBeGreaterThan(1.2);
    expect(contrast(dark.border, dark.surface)).toBeGreaterThan(1.2);
  });
});
