"use client";

import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Campo de foto reusable para los forms (pañal, duda).
 *  - Muestra la foto existente (signed URL) al editar.
 *  - Permite elegir/sacar una foto nueva (preview client-side).
 *  - Permite quitar la existente (marca el hidden `removePhoto`).
 *
 * El archivo viaja por el input `photo` dentro del FormData; la compresión la
 * hace el form en su `action` antes de mandar a la server action.
 */
export function PhotoField({ existingUrl }: { existingUrl?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  // Liberamos el objectURL del preview al desmontar / cambiar.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setRemoved(false);
  }

  function clearNew() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  }

  // Qué se muestra: el preview nuevo manda; si no, la foto existente (salvo que
  // se haya marcado para quitar).
  const shownUrl = previewUrl ?? (removed ? null : existingUrl ?? null);

  return (
    <div className="space-y-2">
      {/* Si se quita la existente sin subir otra, avisamos a la action. */}
      {removed && !previewUrl ? (
        <input type="hidden" name="removePhoto" value="on" />
      ) : null}

      <input
        ref={inputRef}
        className="sr-only"
        id="photo"
        name="photo"
        type="file"
        accept="image/*"
        onChange={onPick}
      />

      {shownUrl ? (
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)]">
          {/* Foto local o signed URL; <img> simple alcanza para el preview. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shownUrl} alt="Foto" className="max-h-56 w-full object-cover" />
          <button
            type="button"
            aria-label="Quitar foto"
            onClick={() => {
              if (previewUrl) {
                clearNew();
              } else {
                setRemoved(true);
              }
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <label
          htmlFor="photo"
          className="tap-target flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--ink-soft)]"
        >
          <Camera size={18} />
          Agregar foto
        </label>
      )}
    </div>
  );
}
