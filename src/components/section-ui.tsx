"use client";

import { Plus } from "lucide-react";

/** Encabezado de una pantalla de sección: título + bajada opcional. */
export function SectionHeading({
  title,
  subtitle
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h1 className="text-3xl font-bold">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm font-semibold text-[var(--ink-soft)]">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Botón primario para abrir el form de alta de una sección. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="tap-target flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
      type="button"
      onClick={onClick}
    >
      <Plus size={20} />
      {label}
    </button>
  );
}

/** Estado vacío reutilizable para las listas. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm font-semibold text-[var(--ink-soft)]">
      {children}
    </p>
  );
}
