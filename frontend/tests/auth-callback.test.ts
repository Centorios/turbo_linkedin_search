// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { GET } from "../app/auth/callback/route";

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options: CookieOptions }[]) => void;
};

const mocks = vi.hoisted(() => ({ create: vi.fn(), exchange: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
  mocks.create.mockReturnValue({ auth: { exchangeCodeForSession: mocks.exchange } });
  mocks.exchange.mockResolvedValue({ data: { session: { user: { id: "user-a" } } }, error: null });
});

function request(query = "") {
  return new NextRequest(`https://cv.example/auth/callback${query}`, {
    headers: { cookie: "sb-project-auth-token-code-verifier=test-verifier" },
  });
}

function expectFailure(response: Response) {
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("https://cv.example/auth?reason=oauth-error");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
}

describe("Retorno OAuth", () => {
  it("intercambia el código una vez y conserva cookies en el destino fijo", async () => {
    mocks.exchange.mockImplementation(async () => {
      const options = mocks.create.mock.calls[0][2] as { cookies: CookieAdapter };
      expect(options.cookies.getAll()).toContainEqual({
        name: "sb-project-auth-token-code-verifier", value: "test-verifier",
      });
      options.cookies.setAll([
        { name: "sb-project-auth-token", value: "session-cookie", options: { path: "/", sameSite: "lax" } },
        { name: "sb-project-auth-token-code-verifier", value: "", options: { path: "/", maxAge: 0 } },
      ]);
      return { data: { session: { user: { id: "user-a" } } }, error: null };
    });

    const response = await GET(request("?code=valid&next=https://external.example"));

    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    expect(mocks.exchange).toHaveBeenCalledWith("valid");
    expect(response.headers.get("location")).toBe("https://cv.example/generate");
    expect(response.cookies.get("sb-project-auth-token")?.value).toBe("session-cookie");
    expect(response.cookies.get("sb-project-auth-token-code-verifier")?.value).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.create).toHaveBeenCalledWith(
      "https://project.supabase.co", "public-test-key", expect.objectContaining({ cookies: expect.any(Object) }),
    );
  });

  it.each(["", "?code=", "?code=%20", "?error=access_denied&error_description=secret", "?error=denied&code=valid"])(
    "rechaza retorno incompleto o cancelado: %s", async (query) => {
      expectFailure(await GET(request(query)));
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.exchange).not.toHaveBeenCalled();
    },
  );

  it("rechaza códigos inválidos o reutilizados sin reflejar detalles externos", async () => {
    mocks.exchange.mockResolvedValue({ data: { session: null }, error: { message: "secret code" } });
    const response = await GET(request("?code=reused"));
    expectFailure(response);
    expect(response.headers.get("location")).not.toContain("secret");
  });

  it("no considera éxito una respuesta sin sesión", async () => {
    mocks.exchange.mockResolvedValue({ data: { session: null }, error: null });
    expectFailure(await GET(request("?code=valid")));
  });

  it("maneja excepción de red como falla explícita de acceso", async () => {
    mocks.exchange.mockRejectedValue(new Error("sensitive network details"));
    expectFailure(await GET(request("?code=valid")));
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])(
    "maneja configuración ausente: %s", async (variable) => {
      vi.stubEnv(variable, "");
      expectFailure(await GET(request("?code=valid")));
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
});
