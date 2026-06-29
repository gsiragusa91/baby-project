"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

/**
 * Fila colapsable de un día pasado: muestra fecha + sumatoria, y al tocarla
 * despliega el detalle (children). Maneja su propio estado abierto/cerrado.
 */
export function DayAccordion({
  label,
  summary,
  children
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <ChevronRight
          size={18}
          className={`shrink-0 text-[var(--ink-soft)] transition-transform ${open ? "rotate-90" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold capitalize">{label}</p>
          <p className="text-xs font-semibold text-[var(--ink-soft)]">{summary}</p>
        </div>
      </button>
      {open ? <div className="space-y-2 px-3 pb-3">{children}</div> : null}
    </div>
  );
}
