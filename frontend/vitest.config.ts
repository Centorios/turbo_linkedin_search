import { defineConfig } from "vitest/config";

export default defineConfig({
  // Matches Next.js's SWC automatic JSX runtime, which every component in
  // this project already assumes (no file imports `React` before using JSX).
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: [],
  },
});
