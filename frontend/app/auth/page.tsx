"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "./actions";

type AuthMode = "sign-in" | "sign-up";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <main>
      <h1>Acceso</h1>
      <div role="tablist" aria-label="Tipo de acceso">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign-in"}
          data-testid="auth-sign-in-tab"
          onClick={() => {
            setMode("sign-in");
            setError(null);
            setMessage(null);
          }}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign-up"}
          data-testid="auth-sign-up-tab"
          onClick={() => {
            setMode("sign-up");
            setError(null);
            setMessage(null);
          }}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="auth-email">Correo electrónico</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          data-testid="auth-email"
        />

        <label htmlFor="auth-password">Contraseña</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
          data-testid="auth-password"
        />

        {error && <p role="alert" data-testid="auth-error">{error}</p>}
        {message && <p role="status" data-testid="auth-message">{message}</p>}

        <button type="submit" disabled={isSubmitting} data-testid="auth-submit">
          {isSubmitting ? "Procesando..." : mode === "sign-in" ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </form>
    </main>
  );
}
