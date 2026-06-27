"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getFamilyContext, type ReadyFamilyContext } from "@/src/data/context";
import { calculateReminderAt } from "@/src/domain/reminders";
import {
  diaperEventInputSchema,
  feedingEventInputSchema,
  questionInputSchema
} from "@/src/domain/schemas";
import { argentinaLocalInputToIso } from "@/src/domain/time";
import type { ReminderOption } from "@/src/domain/types";
import type { VoiceParseResult } from "@/src/domain/voice";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

async function requireReadyContext() {
  const context = await getFamilyContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "missing-family") {
    throw new Error("El usuario no tiene familia/bebé inicial configurados.");
  }

  return context;
}

function optionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createDiaperAction(formData: FormData) {
  const context = await requireReadyContext();
  const parsed = diaperEventInputSchema.parse({
    diaperType: formData.get("diaperType"),
    eventTime: formData.get("eventTime"),
    comment: optionalText(formData.get("comment")) ?? undefined,
    abnormalFlag: formData.get("abnormalFlag") === "on"
  });

  const { error } = await context.supabase.from("diaper_events").insert({
    baby_id: context.baby.id,
    family_id: context.familyId,
    created_by_user_id: context.user.id,
    event_time: argentinaLocalInputToIso(parsed.eventTime),
    diaper_type: parsed.diaperType,
    comment: parsed.comment ?? null,
    abnormal_flag: parsed.abnormalFlag,
    source: "manual"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function createFeedingAction(formData: FormData) {
  const context = await requireReadyContext();
  const parsed = feedingEventInputSchema.parse({
    startedAt: formData.get("startedAt"),
    leftBreastUsed: formData.get("leftBreastUsed") === "on",
    rightBreastUsed: formData.get("rightBreastUsed") === "on",
    leftBreastMinutes: formData.get("leftBreastMinutes"),
    rightBreastMinutes: formData.get("rightBreastMinutes"),
    notes: optionalText(formData.get("notes")) ?? undefined,
    reminderOption: formData.get("reminderOption") ?? "2h30"
  });

  const startedAtIso = argentinaLocalInputToIso(parsed.startedAt);
  const reminderAt = calculateReminderAt(
    startedAtIso,
    parsed.reminderOption as ReminderOption
  );

  const { data: feeding, error } = await context.supabase
    .from("feeding_events")
    .insert({
      baby_id: context.baby.id,
      family_id: context.familyId,
      created_by_user_id: context.user.id,
      started_at: startedAtIso,
      left_breast_used: parsed.leftBreastUsed || Boolean(parsed.leftBreastMinutes),
      right_breast_used: parsed.rightBreastUsed || Boolean(parsed.rightBreastMinutes),
      left_breast_minutes: parsed.leftBreastMinutes ?? null,
      right_breast_minutes: parsed.rightBreastMinutes ?? null,
      notes: parsed.notes ?? null,
      reminder_option: parsed.reminderOption,
      reminder_at: reminderAt,
      source: "manual"
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const savedFeeding = feeding as { id: string } | null;

  if (reminderAt && savedFeeding) {
    const { error: reminderError } = await context.supabase.from("reminders").insert({
      baby_id: context.baby.id,
      family_id: context.familyId,
      created_by_user_id: context.user.id,
      related_event_type: "feeding",
      related_event_id: savedFeeding.id,
      remind_at: reminderAt,
      status: "scheduled",
      channel: "web_push"
    });

    if (reminderError) {
      throw new Error(reminderError.message);
    }
  }

  revalidatePath("/");
}

export async function createQuestionAction(formData: FormData) {
  const context = await requireReadyContext();
  const parsed = questionInputSchema.parse({
    text: formData.get("text"),
    category: formData.get("category") ?? "other",
    professional: formData.get("professional") ?? "pediatrician",
    priority: formData.get("priority") ?? "normal"
  });

  const { error } = await context.supabase.from("questions").insert({
    baby_id: context.baby.id,
    family_id: context.familyId,
    created_by_user_id: context.user.id,
    text: parsed.text,
    category: parsed.category,
    professional: parsed.professional,
    priority: parsed.priority,
    status: "pending",
    source: "manual"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function markQuestionAnsweredAction(formData: FormData) {
  const context = await requireReadyContext();
  const questionId = String(formData.get("questionId") ?? "");

  if (!questionId) {
    return;
  }

  const { error } = await context.supabase
    .from("questions")
    .update({ status: "answered" })
    .eq("id", questionId)
    .eq("family_id", context.familyId)
    .eq("baby_id", context.baby.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function confirmVoiceEventAction(result: VoiceParseResult) {
  const context = await requireReadyContext();

  if (result.proposedEvent.intent === "unknown" || result.intent === "unknown") {
    throw new Error("No se puede guardar un audio que no fue interpretado.");
  }

  try {
    await saveProposedVoiceEvent(context, result);
    await recordVoiceParseLog(context, result, { accepted: true });
    revalidatePath("/");
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Error desconocido al guardar el evento de voz.";
    // El log es best-effort: si falla, NO debe tapar el error real del guardado.
    await recordVoiceParseLog(context, result, { accepted: false, error: message });
    throw error;
  }
}

/**
 * Persiste el evento propuesto por voz. Lanza si Supabase devuelve error o si
 * el intent todavía no es soportado. No hace revalidatePath: de eso se encarga
 * confirmVoiceEventAction una sola vez, en el camino feliz.
 */
async function saveProposedVoiceEvent(
  context: ReadyFamilyContext,
  result: VoiceParseResult
) {
  const { proposedEvent, transcript } = result;

  if (proposedEvent.intent === "register_diaper") {
    if (!proposedEvent.eventTimeLocal || !proposedEvent.diaperType) {
      throw new Error("Faltan datos para guardar el pañal.");
    }

    const { error } = await context.supabase.from("diaper_events").insert({
      baby_id: context.baby.id,
      family_id: context.familyId,
      created_by_user_id: context.user.id,
      event_time: argentinaLocalInputToIso(proposedEvent.eventTimeLocal),
      diaper_type: proposedEvent.diaperType,
      comment: proposedEvent.comment ?? null,
      abnormal_flag: proposedEvent.abnormalFlag ?? false,
      source: "voice",
      transcript
    });

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  if (proposedEvent.intent === "register_feeding") {
    if (!proposedEvent.startedAtLocal) {
      throw new Error("Falta la hora de inicio para guardar la lactancia.");
    }

    const startedAtIso = argentinaLocalInputToIso(proposedEvent.startedAtLocal);
    const reminderOption = proposedEvent.reminderOption ?? "none";
    const reminderAt = calculateReminderAt(startedAtIso, reminderOption);

    const { data: feeding, error } = await context.supabase
      .from("feeding_events")
      .insert({
        baby_id: context.baby.id,
        family_id: context.familyId,
        created_by_user_id: context.user.id,
        started_at: startedAtIso,
        ended_at: proposedEvent.endedAtLocal
          ? argentinaLocalInputToIso(proposedEvent.endedAtLocal)
          : null,
        left_breast_used:
          proposedEvent.leftBreastUsed ?? Boolean(proposedEvent.leftBreastMinutes),
        right_breast_used:
          proposedEvent.rightBreastUsed ?? Boolean(proposedEvent.rightBreastMinutes),
        left_breast_minutes: proposedEvent.leftBreastMinutes ?? null,
        right_breast_minutes: proposedEvent.rightBreastMinutes ?? null,
        notes: proposedEvent.notes ?? null,
        reminder_option: reminderOption,
        reminder_at: reminderAt,
        source: "voice",
        transcript
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const savedFeeding = feeding as { id: string } | null;

    if (reminderAt && savedFeeding) {
      const { error: reminderError } = await context.supabase.from("reminders").insert({
        baby_id: context.baby.id,
        family_id: context.familyId,
        created_by_user_id: context.user.id,
        related_event_type: "feeding",
        related_event_id: savedFeeding.id,
        remind_at: reminderAt,
        status: "scheduled",
        channel: "web_push"
      });

      if (reminderError) {
        throw new Error(reminderError.message);
      }
    }

    return;
  }

  if (proposedEvent.intent === "create_question") {
    const { error } = await context.supabase.from("questions").insert({
      baby_id: context.baby.id,
      family_id: context.familyId,
      created_by_user_id: context.user.id,
      text: proposedEvent.text,
      category: proposedEvent.category ?? "other",
      professional: proposedEvent.professional ?? "other",
      priority: proposedEvent.priority ?? "normal",
      status: "pending",
      source: "voice",
      transcript
    });

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  throw new Error("Todavía no se puede guardar este tipo de evento por voz.");
}

/**
 * Registra el resultado de un intento de voz en `voice_parse_logs`.
 * Best-effort: nunca lanza. Un fallo escribiendo el log no debe romper —ni
 * tapar el error de— el guardado real. Por eso captura tanto la excepción
 * como el `error` que devuelve Supabase, y sólo los loguea por consola.
 */
async function recordVoiceParseLog(
  context: ReadyFamilyContext,
  result: VoiceParseResult,
  outcome: { accepted: boolean; error?: string }
) {
  try {
    const { error } = await context.supabase.from("voice_parse_logs").insert({
      baby_id: context.baby.id,
      family_id: context.familyId,
      user_id: context.user.id,
      transcript: result.transcript,
      detected_intent: result.intent,
      confidence: result.confidence,
      accepted: outcome.accepted,
      discarded: false,
      corrected: false,
      error: outcome.error ?? null
    });

    if (error) {
      console.error("voice_parse_logs insert devolvió error:", error.message);
    }
  } catch (logError) {
    console.error("voice_parse_logs lanzó una excepción:", logError);
  }
}

export async function signOutAction() {
  const context = await getFamilyContext();

  if (context.status !== "unauthenticated") {
    const supabase =
      context.status === "ready"
        ? context.supabase
        : await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
