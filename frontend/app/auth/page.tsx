"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "./actions";
import { BrandLogo } from "../components/brand-logo";
import { AlertIcon, CheckCircleIcon, EyeIcon, EyeOffIcon, SpinnerIcon } from "../components/icons";

type AuthMode = "sign-in" | "sign-up";

export default function AuthPage() {
  return (
    <Suspense fallback={<p role="status">Cargando...</p>}>
      <AuthPageContent />
    </Suspense>
  );
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(
    searchParams.get("reason") === "session-expired" ? "Tu sesión expiró. Vuelve a iniciar sesión." : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim() || !password) {
      setError("Introduce tu correo y contraseña.");
      return;
    }

    setIsSubmitting(true);
    const result = mode === "sign-in" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === "sign-up") {
      setMessage("Cuenta creada correctamente. Ya puedes acceder.");
      setMode("sign-in");
      return;
    }

    router.push("/generate");
    router.refresh();
  }

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center">
        <BrandLogo className="mb-4 h-9 w-auto" />
        <h1 className="text-headline-2xl text-center tracking-tight text-text">Bienvenido a CV8</h1>
        <p className="mt-1.5 text-center text-body-sm text-text-muted">Accede para generar tu currículum con IA</p>

        <div
          role="tablist"
          aria-label="Tipo de acceso"
          className="mt-6 grid w-full grid-cols-2 gap-1 rounded-xl bg-subtle p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign-in"}
            data-testid="auth-sign-in-tab"
            onClick={() => selectMode("sign-in")}
            className={`focus-ring rounded-lg px-3 py-2 text-body-sm font-semibold transition-colors ${
              mode === "sign-in" ? "bg-surface text-primary shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign-up"}
            data-testid="auth-sign-up-tab"
            onClick={() => selectMode("sign-up")}
            className={`focus-ring rounded-lg px-3 py-2 text-body-sm font-semibold transition-colors ${
              mode === "sign-up" ? "bg-surface text-primary shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <div className="mt-4 w-full rounded-xl border border-border bg-surface p-5 shadow-sm">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-body-sm font-semibold text-text">
                Correo electrónico
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                data-testid="auth-email"
                placeholder="nombre@ejemplo.com"
                className="focus-ring w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-body-sm text-text placeholder:text-text-faint"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-body-sm font-semibold text-text">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  data-testid="auth-password"
                  placeholder="••••••••"
                  className="focus-ring w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 pr-10 text-body-sm text-text placeholder:text-text-faint"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="focus-ring absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted"
                >
                  {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                data-testid="auth-error"
                className="flex items-start gap-2 rounded-lg bg-danger-surface p-3 text-body-sm text-danger"
              >
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}
            {message && (
              <p
                role="status"
                data-testid="auth-message"
                className="flex items-start gap-2 rounded-lg bg-success-surface p-3 text-body-sm text-success"
              >
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="auth-submit"
              className="focus-ring mt-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && <SpinnerIcon className="h-4 w-4" />}
              {isSubmitting ? "Procesando..." : mode === "sign-in" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
