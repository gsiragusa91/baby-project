"use client";

import { ShieldAlert } from "lucide-react";

import { createDiaperAction, updateDiaperAction } from "@/app/actions";
import { DIAPER_LABELS } from "@/src/domain/labels";
import { preparePhotoFormData } from "@/src/lib/image";
import type { DiaperType } from "@/src/domain/types";

import { PhotoField } from "./photo-field";

/** Valores iniciales del form. Las horas van en formato datetime-local
 *  (YYYY-MM-DDTHH:mm), así el form no convierte nada. */
export type DiaperInitial = {
  eventTimeLocal?: string;
  diaperType?: DiaperType;
  comment?: string | null;
  abnormalFlag?: boolean | null;
  /** Signed URL de la foto existente (solo para preview al editar). */
  photoUrl?: string | null;
};

const diaperTypes: DiaperType[] = ["pee", "poop", "pee_poop", "dry"];

export function DiaperForm({
  nowLocal,
  initial,
  editId,
  onDone
}: {
  nowLocal: string;
  initial?: DiaperInitial;
  editId?: string;
  onDone?: () => void;
}) {
  const checkedType = initial?.diaperType ?? "pee";
  return (
    <form
      action={async (formData) => {
        await preparePhotoFormData(formData);
        await (editId ? updateDiaperAction : createDiaperAction)(formData);
        onDone?.();
      }}
      className="space-y-4"
    >
      {editId ? <input name="id" type="hidden" value={editId} /> : null}
      <div className="grid grid-cols-2 gap-3">
        {diaperTypes.map((type) => (
          <label
            className="tap-target flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-center text-sm font-bold"
            key={type}
          >
            <input
              className="sr-only peer"
              name="diaperType"
              type="radio"
              value={type}
              defaultChecked={type === checkedType}
            />
            <span className="peer-checked:text-[var(--diaper)]">
              {DIAPER_LABELS[type]}
            </span>
          </label>
        ))}
      </div>
      <input
        className="field"
        name="eventTime"
        type="datetime-local"
        defaultValue={initial?.eventTimeLocal ?? nowLocal}
        required
      />
      <textarea
        className="field min-h-24 resize-none"
        name="comment"
        placeholder="Comentario"
        defaultValue={initial?.comment ?? ""}
      />
      <PhotoField existingUrl={initial?.photoUrl} />
      <label className="flex tap-target items-center gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold">
        <input name="abnormalFlag" type="checkbox" defaultChecked={Boolean(initial?.abnormalFlag)} />
        <ShieldAlert size={20} />
        Marcar para revisar
      </label>
      <button
        className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
        type="submit"
      >
        {editId ? "Guardar cambios" : "Guardar pañal"}
      </button>
    </form>
  );
}
