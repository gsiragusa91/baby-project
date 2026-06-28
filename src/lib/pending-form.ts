import type { VoiceParseResult } from "@/src/domain/voice";

import type { DiaperInitial } from "@/src/components/forms/diaper-form";
import type { FeedingInitial } from "@/src/components/forms/feeding-form";
import type { QuestionInitial } from "@/src/components/forms/question-form";

/** Slug de ruta de cada sección con form. Coincide con app/(app)/<slug>. */
export type FormSection = "panales" | "tomas" | "dudas";

/**
 * Intención de abrir un form en OTRA pantalla (handoff entre rutas).
 * La origina la voz (global) o el timeline de Inicio; la pantalla destino la
 * levanta al montar. Si trae `editId` es edición; si no, alta pre-cargada.
 */
export type PendingForm =
  | { section: "panales"; editId?: string; initial: DiaperInitial }
  | { section: "tomas"; editId?: string; initial: FeedingInitial }
  | { section: "dudas"; editId?: string; initial: QuestionInitial };

const KEY = "baby:pending-form";

/** Evento que avisa que se guardó una intención. Lo escuchan las pantallas para
 *  levantar el handoff aun cuando ya estaban montadas (misma sección). */
export const PENDING_FORM_EVENT = "baby:pending-form";

/** Guarda la intención antes de navegar y avisa a la pantalla activa. */
export function stashPendingForm(pending: PendingForm) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
    window.dispatchEvent(new Event(PENDING_FORM_EVENT));
  } catch {
    // sessionStorage puede no estar disponible (modo privado viejo); el peor
    // caso es que el form no se pre-abra. No rompemos la navegación por esto.
  }
}

/**
 * Lee y consume la intención SI es para esta sección. La borra al leerla para
 * que no reaparezca en la próxima visita. Usa sessionStorage (sobrevive el
 * cambio de ruta pero no un reload), que es justo lo que queremos.
 */
export function popPendingForm(section: FormSection): PendingForm | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingForm;
    if (pending.section !== section) return null;
    sessionStorage.removeItem(KEY);
    return pending;
  } catch {
    return null;
  }
}

/**
 * Convierte el evento propuesto por voz en una intención de form pre-cargado.
 * Devuelve null para intents sin form (recordatorio suelto / no entendido).
 */
export function proposedToPendingForm(result: VoiceParseResult): PendingForm | null {
  const e = result.proposedEvent;

  if (e.intent === "register_diaper") {
    return {
      section: "panales",
      initial: {
        eventTimeLocal: e.eventTimeLocal,
        diaperType: e.diaperType,
        comment: e.comment,
        abnormalFlag: e.abnormalFlag
      }
    };
  }

  if (e.intent === "register_feeding") {
    return {
      section: "tomas",
      initial: {
        startedAtLocal: e.startedAtLocal,
        leftBreastUsed: e.leftBreastUsed,
        rightBreastUsed: e.rightBreastUsed,
        leftBreastMinutes: e.leftBreastMinutes,
        rightBreastMinutes: e.rightBreastMinutes,
        notes: e.notes,
        reminderOption: e.reminderOption,
        customReminderAtLocal:
          e.reminderOption === "custom" ? e.reminderAtLocal : undefined
      }
    };
  }

  if (e.intent === "create_question") {
    return {
      section: "dudas",
      initial: {
        text: e.text,
        category: e.category,
        professional: e.professional,
        priority: e.priority
      }
    };
  }

  return null;
}
