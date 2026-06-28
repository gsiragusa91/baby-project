"use client";

import { createQuestionAction, updateQuestionAction } from "@/app/actions";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROFESSIONAL_LABELS
} from "@/src/domain/labels";
import { preparePhotoFormData } from "@/src/lib/image";
import type { Professional, QuestionCategory, QuestionPriority } from "@/src/domain/types";

import { PhotoField } from "./photo-field";

export type QuestionInitial = {
  text?: string;
  category?: QuestionCategory;
  professional?: Professional;
  priority?: QuestionPriority;
  /** Signed URL de la foto existente (solo para preview al editar). */
  photoUrl?: string | null;
};

export function QuestionForm({
  initial,
  editId,
  onDone
}: {
  initial?: QuestionInitial;
  editId?: string;
  onDone?: () => void;
}) {
  return (
    <form
      action={async (formData) => {
        await preparePhotoFormData(formData);
        await (editId ? updateQuestionAction : createQuestionAction)(formData);
        onDone?.();
      }}
      className="space-y-4"
    >
      {editId ? <input name="id" type="hidden" value={editId} /> : null}
      <textarea
        className="field min-h-28 resize-none"
        name="text"
        placeholder="Duda"
        defaultValue={initial?.text ?? ""}
        required
      />
      <select className="field" name="category" defaultValue={initial?.category ?? "feeding"}>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        className="field"
        name="professional"
        defaultValue={initial?.professional ?? "pediatrician"}
      >
        {Object.entries(PROFESSIONAL_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select className="field" name="priority" defaultValue={initial?.priority ?? "normal"}>
        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <PhotoField existingUrl={initial?.photoUrl} />
      <button
        className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
        type="submit"
      >
        {editId ? "Guardar cambios" : "Guardar duda"}
      </button>
    </form>
  );
}
