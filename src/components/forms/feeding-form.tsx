"use client";

import { createFeedingAction, updateFeedingAction } from "@/app/actions";
import { REMINDER_LABELS } from "@/src/domain/labels";
import { DEFAULT_FEEDING_REMINDER } from "@/src/domain/reminders";
import type { ReminderOption } from "@/src/domain/types";

export type FeedingInitial = {
  startedAtLocal?: string;
  leftBreastUsed?: boolean | null;
  rightBreastUsed?: boolean | null;
  leftBreastMinutes?: number | null;
  rightBreastMinutes?: number | null;
  notes?: string | null;
  reminderOption?: ReminderOption | null;
  customReminderAtLocal?: string | null;
};

export function FeedingForm({
  nowLocal,
  initial,
  editId,
  onDone
}: {
  nowLocal: string;
  initial?: FeedingInitial;
  editId?: string;
  onDone?: () => void;
}) {
  // El <select> muestra el preset si lo había; "custom" se maneja con el campo
  // de hora exacta de abajo (que, si está completo, manda sobre el preset).
  const presetDefault =
    initial?.reminderOption && initial.reminderOption !== "custom"
      ? initial.reminderOption
      : DEFAULT_FEEDING_REMINDER;

  return (
    <form
      action={async (formData) => {
        await (editId ? updateFeedingAction : createFeedingAction)(formData);
        onDone?.();
      }}
      className="space-y-4"
    >
      {editId ? <input name="id" type="hidden" value={editId} /> : null}
      <input
        className="field"
        name="startedAt"
        type="datetime-local"
        defaultValue={initial?.startedAtLocal ?? nowLocal}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <input
              name="leftBreastUsed"
              type="checkbox"
              defaultChecked={initial ? Boolean(initial.leftBreastUsed) : true}
            />
            Izquierda
          </span>
          <input
            className="field mt-3"
            name="leftBreastMinutes"
            type="number"
            min="0"
            max="240"
            inputMode="numeric"
            placeholder="min"
            defaultValue={initial?.leftBreastMinutes ?? ""}
          />
        </label>
        <label className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <input
              name="rightBreastUsed"
              type="checkbox"
              defaultChecked={Boolean(initial?.rightBreastUsed)}
            />
            Derecha
          </span>
          <input
            className="field mt-3"
            name="rightBreastMinutes"
            type="number"
            min="0"
            max="240"
            inputMode="numeric"
            placeholder="min"
            defaultValue={initial?.rightBreastMinutes ?? ""}
          />
        </label>
      </div>
      <select className="field" name="reminderOption" defaultValue={presetDefault}>
        {Object.entries(REMINDER_LABELS)
          .filter(([value]) => value !== "custom")
          .map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
      </select>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
          O alarma a una hora exacta (opcional)
        </span>
        <input
          className="field mt-2"
          name="customReminderAt"
          type="datetime-local"
          defaultValue={initial?.customReminderAtLocal ?? ""}
        />
      </label>
      <textarea
        className="field min-h-24 resize-none"
        name="notes"
        placeholder="Notas"
        defaultValue={initial?.notes ?? ""}
      />
      <button
        className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
        type="submit"
      >
        {editId ? "Guardar cambios" : "Guardar lactancia"}
      </button>
    </form>
  );
}
