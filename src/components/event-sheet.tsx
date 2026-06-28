"use client";

import { Trash2, X } from "lucide-react";

/**
 * Bottom-sheet modal que envuelve un form (alta o edición). Overlay fixed a
 * nivel viewport (no empuja el contenido). Tocar el fondo o la X cierra; en
 * edición muestra el botón de eliminar abajo.
 */
export function EventSheet({
  title,
  onClose,
  onDelete,
  children
}: {
  title: string;
  onClose: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 px-4 pb-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="w-full max-w-[420px]" onClick={(event) => event.stopPropagation()}>
        <section className="sheet rounded-[var(--radius-lg)] px-5 py-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">{title}</h2>
            <button
              aria-label="Cerrar"
              className="tap-target rounded-full border border-[var(--line)] bg-[var(--surface)] p-2"
              type="button"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          {children}

          {onDelete ? (
            <button
              className="tap-target mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-5 py-3 text-sm font-bold text-[var(--danger)]"
              type="button"
              onClick={onDelete}
            >
              <Trash2 size={16} />
              Eliminar registro
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
