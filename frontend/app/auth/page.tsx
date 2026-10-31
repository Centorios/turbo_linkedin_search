"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signInWithGoogle, signUp } from "./actions";
import { BrandLogo } from "../components/brand-logo";
import { ThemeToggle } from "../components/theme-toggle";
import { AlertIcon, CheckCircleIcon, EyeIcon, EyeOffIcon, GoogleIcon, SpinnerIcon } from "../components/icons";

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
  const [error, setError] = useState<string | null>(
    searchParams.get("reason") === "oauth-error"
      ? "No se pudo completar el acceso con tu proveedor. Intentá de nuevo o usá tu correo y contraseña."
      : null,
  );
  const [message, setMessage] = useState<string | null>(
    searchParams.get("reason") === "session-expired" ? "Tu sesión expiró. Volvé a iniciar sesión." : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const isBusy = isSubmitting || isConnectingGoogle;

  async function handleGoogleSignIn() {
    if (isBusy) return;
    setError(null);
    setMessage(null);
    setIsConnectingGoogle(true);
    const result = await signInWithGoogle();

    if (result.error) {
      setError(result.error);
      setIsConnectingGoogle(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    setError(null);
    setMessage(null);

    if (!email.trim() || !password) {
      setError("Ingresá tu correo y contraseña.");
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
      setMessage("Revisá tu correo y abrí el enlace de confirmación para activar tu cuenta. Si no lo encontrás, revisá la carpeta de spam. Después de confirmar tu correo, vas a poder iniciar sesión.");
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
    <main className="app-canvas flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:px-8">
      <div className="mb-4 flex w-full max-w-5xl justify-end">
        <ThemeToggle />
      </div>
      <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-16">
        <section data-testid="auth-introduction" className="brand-panel rounded-3xl p-7 sm:p-10 lg:py-16">
          <div className="relative">
            <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-label-xs text-emerald-200">TU PRÓXIMO CAPÍTULO</span>
            <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Tu experiencia merece<br />un gran currículum.</h2>
            <p className="mt-5 max-w-sm text-body-base leading-relaxed text-indigo-100">Dale forma a tu historia profesional. La IA te ayuda a convertir lo que sabés hacer en un CV claro, listo para compartir.</p>
            <ol className="mt-8 space-y-4 text-body-sm text-indigo-100">
              {["Contá tu trayectoria", "Revisá y elegí tu estilo", "Descargá tu CV en PDF"].map((step, index) => (
                <li key={step} className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 font-semibold text-emerald-200">0{index + 1}</span>{step}</li>
              ))}
            </ol>
            <p className="mt-10 border-t border-white/15 pt-5 text-caption-xs text-indigo-200">Tu historia. Tu estilo. Tu siguiente oportunidad.</p>
          </div>
        </section>
      <div className="mx-auto flex w-full max-w-sm flex-col items-center">
        <BrandLogo className="mb-4 h-20 w-20" />
        <h1 className="text-headline-2xl text-center tracking-tight text-text">Bienvenido a CV8</h1>
        <p className="mt-1.5 text-center text-body-sm text-text-muted">Accedé para generar tu currículum con IA</p>

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
            disabled={isBusy}
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
            disabled={isBusy}
            onClick={() => selectMode("sign-up")}
            className={`focus-ring rounded-lg px-3 py-2 text-body-sm font-semibold transition-colors ${
              mode === "sign-up" ? "bg-surface text-primary shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <div className="workspace-card mt-4 w-full rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <button
            type="button"
            data-testid="auth-google"
            disabled={isBusy}
            aria-busy={isConnectingGoogle}
            onClick={() => void handleGoogleSignIn()}
            className="focus-ring mb-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-body-sm font-semibold text-text transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isConnectingGoogle ? <SpinnerIcon className="h-5 w-5" /> : <GoogleIcon className="h-5 w-5" />}
            {isConnectingGoogle ? "Conectando con Google..." : "Continuar con Google"}
          </button>
          <p className="mb-5 text-center text-caption-xs text-text-muted">O usá tu correo y contraseña</p>
          <form method="post" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
                  aria-label={showPassword ? "Ocultar entrada" : "Mostrar entrada"}
                  aria-pressed={showPassword}
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
              disabled={isBusy}
              data-testid="auth-submit"
              className="focus-ring mt-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && <SpinnerIcon className="h-4 w-4" />}
              {isSubmitting ? "Procesando..." : mode === "sign-in" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>
        </div>
      </div>
      </div>
    </main>
  );
}
