import type { ReminderOption } from "./types";

const REMINDER_MINUTES: Record<Exclude<ReminderOption, "none">, number> = {
  "2h": 120,
  "2h30": 150,
  "3h": 180
};

export function calculateReminderAt(
  startedAtIso: string,
  option: ReminderOption
): string | null {
  if (option === "none") {
    return null;
  }

  const startedAt = new Date(startedAtIso);
  const minutes = REMINDER_MINUTES[option];

  return new Date(startedAt.getTime() + minutes * 60_000).toISOString();
}
