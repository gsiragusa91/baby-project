import { argentinaLocalInputToIso, toArgentinaDateTimeLocal } from "./time";
import type { ReminderOption } from "./types";

const REMINDER_MINUTES: Record<"2h" | "2h30" | "3h", number> = {
  "2h": 120,
  "2h30": 150,
  "3h": 180
};

/** Alarma por defecto cuando no se especifica una (form manual y voz comparten
 *  este valor para no divergir). A futuro podría volverse configurable por usuario. */
export const DEFAULT_FEEDING_REMINDER: ReminderOption = "2h30";

/**
 * Suma minutos a una hora local (formato datetime-local YYYY-MM-DDTHH:mm) y
 * devuelve otra hora local en hora de Argentina. La aritmética se hace sobre
 * el instante absoluto, así no se rompe con cambios de hora ni DST.
 */
export function addMinutesToLocal(local: string, minutes: number): string {
  const baseMs = new Date(argentinaLocalInputToIso(local)).getTime();
  return toArgentinaDateTimeLocal(new Date(baseMs + minutes * 60_000));
}

/**
 * Calcula la hora de la alarma para los presets (2h/2h30/3h) a partir del
 * inicio de la toma. Para "none" y "custom" devuelve null: "none" no tiene
 * alarma y "custom" usa una hora exacta provista por separado (no derivable
 * de un offset).
 */
export function calculateReminderAt(
  startedAtIso: string,
  option: ReminderOption
): string | null {
  if (option === "none" || option === "custom") {
    return null;
  }

  const startedAt = new Date(startedAtIso);
  const minutes = REMINDER_MINUTES[option];

  return new Date(startedAt.getTime() + minutes * 60_000).toISOString();
}
