// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/auth/callback/route";

const fetchMock = vi.fn<typeof fetch>();
const verifier = "test-verifier";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function request() {
  const cookieValue = `base64-${Buffer.from(JSON.stringify(verifier)).toString("base64url")}`;
  return new NextRequest("https://cv.example/auth/callback?code=test-code", {
    headers: { cookie: `sb-project-auth-token-code-verifier=${cookieValue}` },
  });
}

describe("Integración PKCE del callback con Supabase SDK", () => {
  it("envía código/verificador y escribe una sesión legible por el cliente existente", async () => {
    const user = {
      id: "user-a", aud: "authenticated", created_at: "2026-10-14T00:00:00Z",
      app_metadata: { provider: "google" }, user_metadata: {}, email: "ana@example.com",
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      access_token: "test-access-token", refresh_token: "test-refresh-token",
      expires_in: 3600, token_type: "bearer", user,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const response = await GET(request());

    expect(response.headers.get("location")).toBe("https://cv.example/generate");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://project.supabase.co/auth/v1/token?grant_type=pkce");
    expect(JSON.parse(String(options?.body))).toEqual({ auth_code: "test-code", code_verifier: verifier });
    const cookie = response.cookies.get("sb-project-auth-token")?.value;
    expect(cookie).toMatch(/^base64-/);
    const stored = JSON.parse(Buffer.from(cookie!.slice("base64-".length), "base64url").toString());
    expect(stored.user.id).toBe("user-a");
    expect(stored.access_token).toBe("test-access-token");
    expect(response.cookies.get("sb-project-auth-token-code-verifier")?.value).toBe("");
  });

  it("un intercambio rechazado por Supabase no crea cookies de sesión", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      error: "invalid_grant", error_description: "Invalid or expired code",
    }), { status: 400, headers: { "Content-Type": "application/json" } }));

    const response = await GET(request());

    expect(response.headers.get("location")).toBe("https://cv.example/auth?reason=oauth-error");
    expect(response.cookies.get("sb-project-auth-token")).toBeUndefined();
  });
});
