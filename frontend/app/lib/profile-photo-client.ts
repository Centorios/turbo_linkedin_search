import { createSupabaseBrowserClient } from "./supabase";

const bucketName = "profile-photos";
const maxPhotoSize = 5 * 1024 * 1024;
const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateProfilePhoto(file: File): string | null {
  if (!extensionByMimeType[file.type]) {
    return "Selecciona una imagen JPEG, PNG o WebP.";
  }
  if (file.size > maxPhotoSize) {
    return "La foto debe pesar 5 MB o menos.";
  }
  return null;
}

export async function uploadProfilePhoto(file: File): Promise<string> {
  const validationError = validateProfilePhoto(file);
  if (validationError) throw new Error(validationError);

  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user.id) throw new Error("La sesión ha expirado. Vuelve a iniciar sesión.");

  const path = `${session.user.id}/${crypto.randomUUID()}.${extensionByMimeType[file.type]}`;
  const { error } = await supabase.storage.from(bucketName).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error("No se pudo subir la foto. Inténtalo de nuevo.");
  return path;
}

export async function getProfilePhotoUrl(path: string): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error("No se pudo cargar la foto del perfil.");
  return data.signedUrl;
}

export async function deleteProfilePhoto(path: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from(bucketName).remove([path]);
  if (error) throw new Error("No se pudo eliminar la foto anterior.");
}