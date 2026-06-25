"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type Props = {
  /** El texto real que se copia al portapapeles. */
  value: string;
  /** Etiqueta arriba del campo (ej. "Link de invitación"). */
  label: string;
  /** Si es true, muestra el valor grande y centrado (para el código manual). */
  emphasis?: boolean;
};

export function CopyField({ value, label, emphasis = false }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      // Volvemos al ícono normal después de 2s.
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Si el navegador bloquea el portapapeles (http sin permiso, etc.)
      // no rompemos: el usuario todavía puede seleccionar el texto a mano.
    }
  }

  return (
    <div className="mt-3">
      <p className="mb-2 text-sm font-bold text-[var(--ink-soft)]">{label}</p>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copiar ${label.toLowerCase()}`}
        className="tap-target flex w-full items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface-strong)] px-4 py-4 text-left"
      >
        <span
          className={
            emphasis
              ? "flex-1 break-all text-center text-3xl font-extrabold tracking-[0.22em]"
              : "flex-1 break-all text-sm font-bold leading-6"
          }
        >
          {value}
        </span>
        {copied ? (
          <Check className="size-5 shrink-0 text-[var(--primary)]" />
        ) : (
          <Copy className="size-5 shrink-0 text-[var(--ink-soft)]" />
        )}
      </button>
      {copied ? (
        <p className="mt-2 text-sm font-semibold text-[var(--primary)]">
          ¡Copiado!
        </p>
      ) : null}
    </div>
  );
}
