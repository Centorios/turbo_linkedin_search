// @vitest-environment node
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageWasm = resolve(__dirname, "../node_modules/@mediapipe/tasks-vision/wasm");
const servedWasm = resolve(__dirname, "../public/mediapipe/wasm");

function hashes(dir: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(dir)
      .sort()
      .map((name) => [name, createHash("sha256").update(readFileSync(resolve(dir, name))).digest("hex")]),
  );
}

describe("Assets de MediaPipe", () => {
  it("los WASM de public/mediapipe/wasm coinciden con los de node_modules", () => {
    // Si falla: copiar node_modules/@mediapipe/tasks-vision/wasm/* a frontend/public/mediapipe/wasm/.
    expect(hashes(servedWasm), "Recopiá los WASM de @mediapipe/tasks-vision a public/mediapipe/wasm").toEqual(hashes(packageWasm));
  });

  it("el modelo del rostro está versionado", () => {
    const model = readFileSync(resolve(__dirname, "../public/mediapipe/face_landmarker.task"));
    expect(model.length).toBeGreaterThan(1_000_000);
  });
});
