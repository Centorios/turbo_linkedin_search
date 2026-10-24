import { beforeEach, describe, expect, it, vi } from "vitest";
import { signIn, signInWithGoogle, signOut, signUp } from "../app/auth/actions";

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
    expect(await signInWithGoogle()).toEqual({ error: null });
    expect(mocks.oauth).toHaveBeenCalledTimes(1);
    expect(mocks.oauth).toHaveBeenCalledWith({
      provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });

  it("muestra error seguro de Google", async () => {
    mocks.oauth.mockResolvedValue({ data: { url: null }, error: { message: "sensitive provider details" } });
    const result = await signInWithGoogle();
    expect(result.error).toContain("Google");
    expect(result.error).not.toContain("sensitive");
  });

  it("no considera éxito una respuesta sin URL", async () => {
    mocks.oauth.mockResolvedValue({ data: { url: null }, error: null });
    expect((await signInWithGoogle()).error).toBeTruthy();
  });

  it("maneja excepción de red y configuración sin filtrar detalles", async () => {
    mocks.oauth.mockRejectedValue(new Error("sensitive network details"));
    expect((await signInWithGoogle()).error).not.toContain("sensitive");
    mocks.create.mockImplementation(() => { throw new Error("missing configuration"); });
    expect((await signInWithGoogle()).error).toContain("Google");
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

  it.each([
    ["invalid_credentials", "El correo o la contraseña no son correctos."],
    ["email_not_confirmed", "Confirmá tu correo antes de iniciar sesión. Revisá tu bandeja de entrada."],
    ["over_request_rate_limit", "Hiciste demasiados intentos. Esperá unos minutos y volvé a probar."],
  ])("traduce el error %s de Supabase al iniciar sesión", async (code, message) => {
    mocks.password.mockResolvedValue({ error: Object.assign(new Error("Invalid login credentials"), { code }) });
    expect(await signIn("ana@example.com", "wrong")).toEqual({ error: message });
  });

  it.each([
    ["user_already_exists", "Ya existe una cuenta con ese correo. Iniciá sesión."],
    ["email_exists", "Ya existe una cuenta con ese correo. Iniciá sesión."],
    ["weak_password", "La contraseña es muy débil: usá al menos 6 caracteres."],
    ["email_address_invalid", "Ingresá un correo válido."],
    ["signup_disabled", "El registro de cuentas está deshabilitado por el momento."],
  ])("traduce el error %s de Supabase al crear la cuenta", async (code, message) => {
    mocks.signup.mockResolvedValue({ error: Object.assign(new Error("User already registered"), { code }) });
    expect(await signUp("ana@example.com", "password")).toEqual({ error: message });
  });

  it("nunca muestra el texto en inglés de un error desconocido", async () => {
    mocks.password.mockResolvedValue({ error: Object.assign(new Error("Database error saving new user"), { code: "unexpected_failure" }) });
    mocks.signup.mockResolvedValue({ error: new Error("Some English message") });
    mocks.signout.mockResolvedValue({ error: new Error("Session not found") });

    expect(await signIn("ana@example.com", "x")).toEqual({ error: "Las credenciales no son válidas" });
    expect(await signUp("ana@example.com", "x")).toEqual({ error: "No se pudo crear la cuenta" });
    expect(await signOut()).toEqual({ error: "No se pudo cerrar la sesión" });
  });

  it("distingue un límite de intentos por el estado HTTP y una falla de red", async () => {
    mocks.password.mockResolvedValueOnce({ error: Object.assign(new Error("Too many"), { status: 429 }) });
    expect((await signIn("ana@example.com", "x")).error).toBe("Hiciste demasiados intentos. Esperá unos minutos y volvé a probar.");

    mocks.password.mockResolvedValueOnce({ error: Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError" }) });
    expect((await signIn("ana@example.com", "x")).error).toBe("No se pudo conectar con el servidor. Intentá de nuevo.");
  });

  it("una excepción al iniciar sesión usa el mensaje genérico en español", async () => {
    mocks.create.mockImplementation(() => { throw new Error("Falta la configuración pública de Supabase."); });
    expect(await signIn("ana@example.com", "x")).toEqual({ error: "Las credenciales no son válidas" });
  });
});
