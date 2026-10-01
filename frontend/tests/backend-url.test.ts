import { afterEach, describe, expect, it, vi } from "vitest";
import { getBackendUrl } from "../app/lib/backend-url";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function visit(url: string) {
  vi.stubGlobal("window", { location: new URL(url) });
}

describe("backend URL routing", () => {
  it.each(["http://127.0.0.1:8000", "http://localhost:8000/", "http://[::1]:8000", "http://api.localhost:8000"])(
    "routes deployed API calls to the same origin instead of %s", (backend) => {
      visit("https://turbo-linkedin-search.vercel.app/generate");
      vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", backend);
      expect(getBackendUrl()).toBe("");
    },
  );

  it("keeps the separate backend during local development", () => {
    visit("http://localhost:3001/generate");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "http://127.0.0.1:18000/");
    expect(getBackendUrl()).toBe("http://127.0.0.1:18000");
  });

  it("preserves a configured remote backend", () => {
    visit("https://turbo-linkedin-search.vercel.app/generate");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", " https://cv-api.example.com/ ");
    expect(getBackendUrl()).toBe("https://cv-api.example.com");
  });

  it("defaults to the same origin without an override", () => {
    visit("https://turbo-linkedin-search.vercel.app/generate");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", undefined);
    expect(getBackendUrl()).toBe("");
  });
});
