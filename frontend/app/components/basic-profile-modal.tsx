"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CameraCapture, isCameraSupported } from "./camera-capture";
import { FilePickerButton } from "./file-picker-button";
import { deleteProfilePhoto, getProfilePhotoUrl, uploadProfilePhoto, validateProfilePhoto } from "../lib/profile-photo-client";
import type { BasicProfile } from "../types/profile";

type BasicProfileModalProps = {
  email: string;
  profile: BasicProfile | null;
  isSaving: boolean;
  isEditing?: boolean;
  saveError: string | null;
  onSave: (profile: BasicProfile) => Promise<boolean>;
  onDefer: () => void;
  onSaved?: () => void;
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
    photoPath: null,
  };
}

function profileFormValues(profile: BasicProfile | null, email: string): BasicProfile {
  if (!profile) return emptyProfile(email);
  return { ...profile, email: profile.email || email };
}

function validateProfile(profile: BasicProfile): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!profile.fullName.trim()) {
    errors.fullName = "Ingresá tu nombre completo.";
  }
  if (profile.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.email)) {
    errors.email = "Ingresá un correo válido o dejá el campo vacío.";
  }
  for (const field of ["linkedin", "website"] as const) {
    const value = profile[field];
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors[field] = "Usá una dirección que empiece con http:// o https://.";
      }
    } catch {
      errors[field] = "Ingresá una dirección web válida o dejá el campo vacío.";
    }
  }
  return errors;
}

export function BasicProfileModal({
  email,
  profile,
  isSaving,
  isEditing = false,
  saveError,
  onSave,
  onDefer,
  onSaved,
}: BasicProfileModalProps) {
  const [values, setValues] = useState<BasicProfile>(() => profileFormValues(profile, email));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [selectedPhoto, setSelectedPhoto] = useState<{ file: File; url: string; fromCamera: boolean } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Read after mount: the server (and the first render) cannot know about the camera.
  const [cameraSupported, setCameraSupported] = useState(false);
  useEffect(() => setCameraSupported(isCameraSupported()), []);
  const [storedPhotoUrl, setStoredPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    setValues(profileFormValues(profile, email));
    setErrors({});
    setSelectedPhoto(null);
    setPhotoError(null);
  }, [email, profile]);

  useEffect(() => {
    return () => {
      if (selectedPhoto) URL.revokeObjectURL(selectedPhoto.url);
    };
  }, [selectedPhoto]);

  useEffect(() => {
    let active = true;
    setStoredPhotoUrl(null);
    if (!values.photoPath) return () => { active = false; };
    void getProfilePhotoUrl(values.photoPath)
      .then((url) => { if (active) setStoredPhotoUrl(url); })
      .catch(() => { if (active) setPhotoError("No se pudo cargar la foto guardada. Podés seleccionar otra."); });
    return () => { active = false; };
  }, [values.photoPath]);

  function updateField(field: keyof BasicProfile, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function selectPhoto(file: File | undefined, fromCamera = false) {
    if (!file) return;
    const validationError = validateProfilePhoto(file);
    if (validationError) {
      setPhotoError(validationError);
      return;
    }
    setPhotoError(null);
    setSelectedPhoto({ file, url: URL.createObjectURL(file), fromCamera });
  }

  function removePhoto() {
    setSelectedPhoto(null);
    setStoredPhotoUrl(null);
    setPhotoError(null);
    setValues((current) => ({ ...current, photoPath: null }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateProfile(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setCameraOpen(false);
    setPhotoError(null);
    let uploadedPath: string | null = null;
    const nextProfile = { ...values, fullName: values.fullName.trim() };
    try {
      if (selectedPhoto) {
        uploadedPath = await uploadProfilePhoto(selectedPhoto.file);
        nextProfile.photoPath = uploadedPath;
      }
      const saved = await onSave(nextProfile);
      if (!saved && uploadedPath) {
        await deleteProfilePhoto(uploadedPath).catch(() => undefined);
        return;
      }
      if (saved) onSaved?.();
    } catch (submitError) {
      if (uploadedPath) await deleteProfilePhoto(uploadedPath).catch(() => undefined);
      setPhotoError(submitError instanceof Error ? submitError.message : "No se pudo guardar la foto.");
    }
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
            {isEditing ? "Editar perfil" : "Completá tu perfil básico"}
          </h2>
          <p className="mt-2 text-body-sm text-text-muted">
            {isEditing
              ? "Actualizá los datos personales que aparecerán en tus CVs."
              : "Estos datos se usarán en la información personal de tus CVs. Podés completarlos ahora o más tarde."}
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

          <div className="sm:col-span-2">
            <label htmlFor="profile-photo" className="mb-1.5 block text-body-sm font-semibold text-text">
              Foto de perfil <span className="font-normal text-text-muted">(opcional)</span>
            </label>
            <FilePickerButton
              id="profile-photo"
              accept="image/jpeg,image/png,image/webp"
              disabled={isSaving}
              describedBy="profile-photo-hint"
              fileName={
                selectedPhoto ? (selectedPhoto.fromCamera ? "Foto de la cámara" : selectedPhoto.file.name) : values.photoPath ? "Foto guardada" : null
              }
              onSelect={(file) => selectPhoto(file)}
              testIds={{ input: "profile-photo-input", browse: "profile-photo-browse", filename: "profile-photo-filename" }}
              className="flex w-full flex-wrap items-center gap-3"
            >
              {cameraSupported && (
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  disabled={isSaving || cameraOpen}
                  data-testid="profile-photo-camera-open"
                  className="focus-ring shrink-0 rounded-lg border border-primary bg-surface px-4 py-2 text-body-sm font-semibold text-primary transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Usar cámara
                </button>
              )}
            </FilePickerButton>
            {cameraOpen && (
              <CameraCapture onCapture={(file) => selectPhoto(file, true)} onClose={() => setCameraOpen(false)} />
            )}
            <p id="profile-photo-hint" className="mt-1 text-caption-xs text-text-muted">
              JPEG, PNG o WebP; máximo 5 MB.
            </p>
            {(selectedPhoto?.url || storedPhotoUrl) && (
              <img
                src={selectedPhoto?.url ?? storedPhotoUrl ?? ""}
                alt="Foto de perfil"
                data-testid="profile-photo-preview"
                className="mt-3 h-20 w-20 rounded-full border border-border object-cover"
              />
            )}
            {(selectedPhoto || values.photoPath) && (
              <button
                type="button"
                onClick={removePhoto}
                disabled={isSaving}
                data-testid="profile-photo-remove"
                className="focus-ring mt-2 rounded-md border border-border px-3 py-1.5 text-caption-xs font-semibold text-text-muted disabled:opacity-60"
              >
                Quitar foto
              </button>
            )}
            {photoError && (
              <p role="alert" data-testid="profile-photo-error" className="mt-2 text-caption-xs text-danger">
                {photoError}
              </p>
            )}
          </div>

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
              {isEditing ? "Cancelar" : "Completar más tarde"}
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
