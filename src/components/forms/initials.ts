import { toArgentinaDateTimeLocal } from "@/src/domain/time";
import type { DiaperEvent, FeedingEvent, Question } from "@/src/domain/types";

import type { DiaperInitial } from "./diaper-form";
import type { FeedingInitial } from "./feeding-form";
import type { QuestionInitial } from "./question-form";

/** ISO -> datetime-local en hora de Argentina, para pre-cargar inputs date. */
export function isoToLocalInput(iso?: string | null) {
  return iso ? toArgentinaDateTimeLocal(new Date(iso)) : undefined;
}

// --- Mappers de evento guardado -> valores iniciales del form de edición ---

export function diaperToInitial(event: DiaperEvent): DiaperInitial {
  return {
    eventTimeLocal: isoToLocalInput(event.eventTime),
    diaperType: event.diaperType,
    comment: event.comment,
    abnormalFlag: event.abnormalFlag,
    photoUrl: event.photoSignedUrl
  };
}

export function feedingToInitial(event: FeedingEvent): FeedingInitial {
  return {
    startedAtLocal: isoToLocalInput(event.startedAt),
    leftBreastUsed: event.leftBreastUsed,
    rightBreastUsed: event.rightBreastUsed,
    leftBreastMinutes: event.leftBreastMinutes,
    rightBreastMinutes: event.rightBreastMinutes,
    notes: event.notes,
    reminderOption: event.reminderOption,
    customReminderAtLocal:
      event.reminderOption === "custom" ? isoToLocalInput(event.reminderAt) : undefined
  };
}

export function questionToInitial(event: Question): QuestionInitial {
  return {
    text: event.text,
    category: event.category,
    professional: event.professional,
    priority: event.priority,
    photoUrl: event.photoSignedUrl
  };
}
