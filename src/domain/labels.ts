import type {
  DiaperType,
  Professional,
  QuestionCategory,
  QuestionPriority,
  ReminderOption
} from "./types";

export const DIAPER_LABELS: Record<DiaperType, string> = {
  pee: "Pis",
  poop: "Caca",
  pee_poop: "Pis + caca",
  dry: "Seco"
};

export const REMINDER_LABELS: Record<ReminderOption, string> = {
  "2h": "2 h",
  "2h30": "2 h 30",
  "3h": "3 h",
  none: "Sin alarma"
};

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  feeding: "Lactancia",
  diaper: "Pañales",
  sleep: "Sueño",
  weight: "Peso",
  skin: "Piel",
  umbilical_cord: "Cordón",
  medication: "Medicación",
  other: "Otro"
};

export const PROFESSIONAL_LABELS: Record<Professional, string> = {
  pediatrician: "Pediatra",
  neonatologist: "Neonatólogo",
  lactation_consultant: "Puericultora",
  other: "Otro"
};

export const PRIORITY_LABELS: Record<QuestionPriority, string> = {
  normal: "Normal",
  next_visit: "Próxima consulta",
  urgent: "Revisar antes"
};
