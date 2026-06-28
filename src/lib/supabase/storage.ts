import type { ReadyFamilyContext } from "@/src/data/context";

/** Bucket privado de fotos. Se sirve siempre vía signed URLs (nunca público). */
export const MEDIA_BUCKET = "baby-media";

/** Tipo de foto → segmento {kind} del path. */
export type MediaKind = "diaper" | "question" | "album";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/**
 * Sube una foto al bucket privado y devuelve su *path* (lo que se persiste en DB).
 * El nombre es un UUID random, no el id de la fila: así sirve igual para alta y
 * edición sin depender de tener el id antes de insertar.
 */
export async function uploadPhoto(
  context: ReadyFamilyContext,
  kind: MediaKind,
  file: File
): Promise<string> {
  const ext = EXT_BY_TYPE[file.type] ?? "jpg";
  const path = `families/${context.familyId}/${kind}/${crypto.randomUUID()}.${ext}`;

  const { error } = await context.supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

/**
 * Genera signed URLs para una lista de paths en una sola llamada. Devuelve un
 * Map path→url (los paths sin URL quedan afuera). TTL por defecto 1h.
 */
export async function signedUrlsFor(
  context: ReadyFamilyContext,
  paths: Array<string | null | undefined>,
  ttlSeconds = 3600
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];

  if (unique.length === 0) {
    return map;
  }

  const { data, error } = await context.supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(unique, ttlSeconds);

  if (error) {
    throw new Error(error.message);
  }

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      map.set(item.path, item.signedUrl);
    }
  }

  return map;
}
