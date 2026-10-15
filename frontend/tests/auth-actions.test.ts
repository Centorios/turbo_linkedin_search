import { beforeEach, describe, expect, it, vi } from "vitest";
import { signIn, signInWithProvider, signOut, signUp } from "../app/auth/actions";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), oauth: vi.fn(), password: vi.fn(), signup: vi.fn(), signout: vi.fn(),
}));
vi.mock("../app/lib/supabase", () => ({ createSupabaseBrowserClient: mocks.create }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockReturnValue({
    auth: { signInWithOAuth: mocks.oauth, signInWithPassword: mocks.password, signUp: mocks.signup, signOut: mocks.signout },
  });
  mocks.oauth.mockResolvedValue({ data: { url: "https://project.supabase.co/auth/v1/authorize" }, error: null });
});

describe("Acciones de autenticación", () => {
  it("inicia Google con retorno fijo en el origen actual", async () => {
    expect(await signInWithProvider("google")).toEqual({ error: null });
    expect(mocks.oauth).toHaveBeenCalledTimes(1);
    expect(mocks.oauth).toHaveBeenCalledWith({
      provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });

  it("inicia Microsoft como Azure y solicita email", async () => {
    expect(await signInWithProvider("azure")).toEqual({ error: null });
    expect(mocks.oauth).toHaveBeenCalledTimes(1);
    expect(mocks.oauth).toHaveBeenCalledWith({
      provider: "azure", options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: "email" },
    });
  });

  it.each(["google", "azure"] as const)("muestra error seguro del proveedor %s", async (provider) => {
    mocks.oauth.mockResolvedValue({ data: { url: null }, error: { message: "sensitive provider details" } });
    const result = await signInWithProvider(provider);
    expect(result.error).toContain(provider === "google" ? "Google" : "Microsoft");
    expect(result.error).not.toContain("sensitive");
  });

  it("no considera éxito una respuesta sin URL", async () => {
    mocks.oauth.mockResolvedValue({ data: { url: null }, error: null });
    expect((await signInWithProvider("google")).error).toBeTruthy();
  });

  it("maneja excepción de red y configuración sin filtrar detalles", async () => {
    mocks.oauth.mockRejectedValue(new Error("sensitive network details"));
    expect((await signInWithProvider("google")).error).not.toContain("sensitive");
    mocks.create.mockImplementation(() => { throw new Error("missing configuration"); });
    expect((await signInWithProvider("azure")).error).toContain("Microsoft");
  });

  it("conserva acceso, registro y cierre por contraseña", async () => {
    for (const action of [mocks.password, mocks.signup, mocks.signout]) {
      action.mockResolvedValue({ error: null });
    }
    expect(await signIn("ana@example.com", "password")).toEqual({ error: null });
    expect(await signUp("ana@example.com", "password")).toEqual({ error: null });
    expect(await signOut()).toEqual({ error: null });
    expect(mocks.password).toHaveBeenCalledWith({ email: "ana@example.com", password: "password" });
    expect(mocks.signup).toHaveBeenCalledWith({ email: "ana@example.com", password: "password" });
  });

  it("conserva errores de contraseña existentes", async () => {
    mocks.password.mockResolvedValue({ error: new Error("Credenciales inválidas") });
    expect(await signIn("ana@example.com", "wrong")).toEqual({ error: "Credenciales inválidas" });
  });
});
