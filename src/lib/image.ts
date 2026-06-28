"use client";

/**
 * Redimensiona una imagen en el browser antes de subirla. Las fotos de celular
 * pesan 3-8MB y los Server Actions de Next tienen un límite de body chico; bajar
 * a ~1600px / JPEG las deja en ~200-400KB, entra holgada y ahorra storage.
 *
 * Si algo falla (tipo no-imagen, sin canvas), devuelve el archivo original: la
 * compresión es una optimización, no un requisito de correctitud.
 */
export async function downscaleImage(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) {
      return file;
    }

    const name = file.name.replace(/\.\w+$/, "") || "foto";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * Deja el FormData listo para mandar a la server action: si hay una foto nueva
 * la comprime; si el input quedó vacío saca la clave (un File vacío no debería
 * viajar). Para usar dentro del `action` de un form, antes de invocar la action.
 */
export async function preparePhotoFormData(formData: FormData): Promise<void> {
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    formData.set("photo", await downscaleImage(photo));
  } else {
    formData.delete("photo");
  }
}
