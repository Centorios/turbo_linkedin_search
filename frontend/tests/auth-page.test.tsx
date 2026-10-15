import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthPage from "../app/auth/page";

const mocks = vi.hoisted(() => ({
  provider: vi.fn(), signin: vi.fn(), signup: vi.fn(), push: vi.fn(), refresh: vi.fn(), query: "",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(mocks.query),
}));
vi.mock("../app/auth/actions", () => ({
  signInWithProvider: mocks.provider, signIn: mocks.signin, signUp: mocks.signup,
}));

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.query = "";
  mocks.provider.mockResolvedValue({ error: null });
  mocks.signin.mockResolvedValue({ error: null });
  mocks.signup.mockResolvedValue({ error: null });
});

function disabled(testId: string) {
  return (screen.getByTestId(testId) as HTMLButtonElement).disabled;
}

function fillPassword() {
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@example.com" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "password" } });
}

describe("Página de acceso social", () => {
  it.each([
    ["Google", "google"], ["Microsoft", "azure"],
  ])("ofrece %s en acceso y registro e inicia el proveedor correcto", async (label, provider) => {
    render(<AuthPage />);
    const button = screen.getByRole("button", { name: `Continuar con ${label}` });
    expect(button).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Crear cuenta" }));
    fireEvent.click(button);
    await waitFor(() => expect(mocks.provider).toHaveBeenCalledWith(provider));
    expect(mocks.signin).not.toHaveBeenCalled();
    expect(mocks.signup).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("bloquea todos los accesos durante la navegación al proveedor", async () => {
    mocks.provider.mockReturnValue(new Promise(() => {}));
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));
    for (const id of ["auth-google", "auth-microsoft", "auth-submit", "auth-sign-in-tab", "auth-sign-up-tab"]) {
      expect(disabled(id)).toBe(true);
    }
    fireEvent.click(screen.getByTestId("auth-microsoft"));
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("muestra falla al iniciar y permite reintentar con otro proveedor", async () => {
    mocks.provider.mockResolvedValueOnce({ error: "No se pudo iniciar sesión con Google." });
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Google");
    expect(disabled("auth-google")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Microsoft" }));
    await waitFor(() => expect(mocks.provider).toHaveBeenLastCalledWith("azure"));
  });

  it("muestra error seguro de retorno sin reflejar parámetros externos", () => {
    mocks.query = "reason=oauth-error&error_description=sensitive-provider-token";
    render(<AuthPage />);
    expect(screen.getByRole("alert").textContent).toContain("No se pudo completar");
    expect(screen.queryByText(/sensitive-provider-token/)).toBeNull();
  });

  it("conserva login por contraseña y bloquea proveedores mientras procesa", async () => {
    let complete!: (result: { error: null }) => void;
    mocks.signin.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    render(<AuthPage />);
    fillPassword();
    fireEvent.click(screen.getByTestId("auth-submit"));
    expect(disabled("auth-google")).toBe(true);
    expect(disabled("auth-microsoft")).toBe(true);
    complete({ error: null });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/generate"));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("conserva registro por contraseña", async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Crear cuenta" }));
    fillPassword();
    fireEvent.click(screen.getByTestId("auth-submit"));
    expect((await screen.findByTestId("auth-message")).textContent).toContain("Cuenta creada");
    expect(mocks.signup).toHaveBeenCalledWith("ana@example.com", "password");
  });

  it("conserva aviso de expiración y validación de campos", () => {
    mocks.query = "reason=session-expired";
    render(<AuthPage />);
    expect(screen.getByTestId("auth-message").textContent).toContain("Tu sesión expiró");
    fireEvent.click(screen.getByTestId("auth-submit"));
    expect(screen.getByRole("alert").textContent).toContain("Introduce tu correo");
    expect(mocks.signin).not.toHaveBeenCalled();
  });
});
