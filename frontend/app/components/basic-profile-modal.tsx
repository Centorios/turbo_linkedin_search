"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { BasicProfile } from "../types/profile";

type BasicProfileModalProps = {
  email: string;
  profile: BasicProfile | null;
  isSaving: boolean;
  saveError: string | null;
  onSave: (profile: BasicProfile) => Promise<void>;
  onDefer: () => void;
};

type ProfileErrors = Partial<Record<keyof BasicProfile, string>>;

const fields: { name: keyof BasicProfile; label: string; type: string }[] = [
  { name: "fullName", label: "Nombre completo", type: "text" },
  { name: "email", label: "Correo para el CV", type: "email" },
  { name: "phone", label: "Teléfono", type: "tel" },
  { name: "location", label: "Ubicación", type: "text" },
  { name: "linkedin", label: "Perfil de LinkedIn", type: "url" },
  { name: "website", label: "Sitio web", type: "url" },
];

function emptyProfile(email: string): BasicProfile {
  return {
    fullName: "",
    email,
    phone: "",
    location: "",
    linkedin: "",
    website: "",
  };
}

function profileFormValues(profile: BasicProfile | null, email: string): BasicProfile {
  if (!profile) return emptyProfile(email);
  return { ...profile, email: profile.email || email };
}

function validateProfile(profile: BasicProfile): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!profile.fullName.trim()) {
    errors.fullName = "Introduce tu nombre completo.";
  }
  if (profile.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.email)) {
    errors.email = "Introduce un correo válido o deja el campo vacío.";
  }
  for (const field of ["linkedin", "website"] as const) {
    const value = profile[field];
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors[field] = "Usa una dirección que empiece por http:// o https://.";
      }
    } catch {
      errors[field] = "Introduce una dirección web válida o deja el campo vacío.";
    }
  }
  return errors;
}

export function BasicProfileModal({
  email,
  profile,
  isSaving,
  saveError,
  onSave,
  onDefer,
}: BasicProfileModalProps) {
  const [values, setValues] = useState<BasicProfile>(() => profileFormValues(profile, email));
  const [errors, setErrors] = useState<ProfileErrors>({});

  useEffect(() => {
    setValues(profileFormValues(profile, email));
    setErrors({});
  }, [email, profile]);

  function updateField(field: keyof BasicProfile, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateProfile(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSave({ ...values, fullName: values.fullName.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="basic-profile-title"
        data-testid="basic-profile-modal"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !isSaving) onDefer();
        }}
        className="my-auto max-h-[min(90vh,760px)] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        <header>
          <h2 id="basic-profile-title" className="text-headline-lg text-text">
            Completa tu perfil básico
          </h2>
          <p className="mt-2 text-body-sm text-text-muted">
            Estos datos se usarán en la información personal de tus CVs. Puedes completarlos ahora o más tarde.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const errorId = `${field.name}-error`;
            return (
              <div key={field.name} className={field.name === "fullName" ? "sm:col-span-2" : ""}>
                <label htmlFor={field.name} className="mb-1.5 block text-body-sm font-semibold text-text">
                  {field.label}
                  {field.name === "fullName" && <span aria-hidden="true"> *</span>}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  value={values[field.name]}
                  autoFocus={field.name === "fullName"}
                  onChange={(event) => updateField(field.name, event.target.value)}
                  required={field.name === "fullName"}
                  aria-invalid={Boolean(errors[field.name])}
                  aria-describedby={errors[field.name] ? errorId : undefined}
                  data-testid={`profile-${field.name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`}
                  className="focus-ring w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-body-sm text-text"
                />
                {errors[field.name] && (
                  <p id={errorId} role="alert" className="mt-1 text-caption-xs text-danger">
                    {errors[field.name]}
                  </p>
                )}
              </div>
            );
          })}

          {saveError && (
            <p role="alert" data-testid="profile-save-error" className="sm:col-span-2 text-body-sm text-danger">
              {saveError}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4 sm:col-span-2">
            <button
              type="button"
              onClick={onDefer}
              disabled={isSaving}
              data-testid="profile-defer"
              className="focus-ring rounded-lg border border-border px-4 py-2 text-body-sm font-semibold text-text-muted hover:bg-subtle disabled:opacity-60"
            >
              Completar más tarde
            </button>
            <button
              type="submit"
              disabled={isSaving}
              data-testid="profile-save"
              className="focus-ring rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Guardando..." : "Guardar perfil"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}