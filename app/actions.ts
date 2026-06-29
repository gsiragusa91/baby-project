"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getFamilyContext, type ReadyFamilyContext } from "@/src/data/context";
import { DEFAULT_FEEDING_REMINDER, calculateReminderAt } from "@/src/domain/reminders";
import {
  babyEditSchema,
  babyPhotoInputSchema,
  deleteByIdSchema,
  diaperEventEditSchema,
  diaperEventInputSchema,
  feedingEventEditSchema,
  feedingEventInputSchema,
  questionEditSchema,
  questionInputSchema
} from "@/src/domain/schemas";
import { argentinaLocalInputToIso } from "@/src/domain/time";
import type { ReminderOption } from "@/src/domain/types";
import type { VoiceParseResult } from "@/src/domain/voice";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { MEDIA_BUCKET, uploadPhoto, type MediaKind } from "@/src/lib/supabase/storage";

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

/**
 * Resuelve qué hacer con la foto a partir del FormData:
 *  - File nuevo (con peso) → lo sube y devuelve el path.
 *  - removePhoto=on → null (quitar).
 *  - nada → undefined (no tocar la columna).
 * El form ya comprimió la imagen antes de mandarla (preparePhotoFormData).
 */
async function resolvePhoto(
  context: ReadyFamilyContext,
  kind: MediaKind,
  formData: FormData
): Promise<string | null | undefined> {
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    return uploadPhoto(context, kind, photo);
  }
  if (formData.get("removePhoto") === "on") {
    return null;
  }
  return undefined;
}

function optionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resuelve la hora absoluta (ISO) de la alarma de una toma y el reminder_option
 * a guardar. Si vino una hora exacta (customReminderAt) manda sobre el preset y
 * se persiste como 'custom'.
 */
function resolveFeedingReminder(parsed: {
  startedAt: string;
  reminderOption: ReminderOption;
  customReminderAt?: string;
}): { reminderAtIso: string | null; reminderOption: ReminderOption } {
  if (parsed.customReminderAt) {
    return {
      reminderAtIso: argentinaLocalInputToIso(parsed.customReminderAt),
      reminderOption: "custom"
    };
  }

  const startedAtIso = argentinaLocalInputToIso(parsed.startedAt);
  return {
    reminderAtIso: calculateReminderAt(startedAtIso, parsed.reminderOption),
    reminderOption: parsed.reminderOption
  };
}

/**
 * Sincroniza la alarma de una toma: borra las alarmas 'scheduled' previas de esa
 * toma y crea una nueva si corresponde. Idempotente — sirve igual para alta y
 * edición (al crear no hay previas, así que el delete es no-op).
 */
async function syncFeedingReminder(
  context: ReadyFamilyContext,
  feedingId: string,
  reminderAtIso: string | null
) {
  const { error: deleteError } = await context.supabase
    .from("reminders")
    .delete()
    .eq("family_id", context.familyId)
    .eq("related_event_type", "feeding")
    .eq("related_event_id", feedingId)
    .eq("status", "scheduled");

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (!reminderAtIso) {
    return;
  }

  const { error: insertError } = await context.supabase.from("reminders").insert({
    baby_id: context.baby.id,
    family_id: context.familyId,
    created_by_user_id: context.user.id,
    related_event_type: "feeding",
    related_event_id: feedingId,
    remind_at: reminderAtIso,
    status: "scheduled",
    channel: "web_push"
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function createDiaperAction(formData: FormData) {
  const context = await requireReadyContext();
  const parsed = diaperEventInputSchema.parse({
    diaperType: formData.get("diaperType"),
    eventTime: formData.get("eventTime"),
    comment: optionalText(formData.get("comment")) ?? undefined,
    abnormalFlag: formData.get("abnormalFlag") === "on"
  });

  const photoUrl = await resolvePhoto(context, "diaper", formData);

  const { error } = await context.supabase.from("diaper_events").insert({
    baby_id: context.baby.id,
    family_id: context.familyId,
    created_by_user_id: context.user.id,
    event_time: argentinaLocalInputToIso(parsed.eventTime),
    diaper_type: parsed.diaperType,
    comment: parsed.comment ?? null,
    photo_url: photoUrl ?? null,
    abnormal_flag: parsed.abnormalFlag,
    source: "manual"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
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
    reminderOption: formData.get("reminderOption") ?? "2h30",
    customReminderAt: formData.get("customReminderAt")
  });

  const startedAtIso = argentinaLocalInputToIso(parsed.startedAt);
  const { reminderAtIso, reminderOption } = resolveFeedingReminder(parsed);

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
      reminder_option: reminderOption,
      reminder_at: reminderAtIso,
      source: "manual"
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const savedFeeding = feeding as { id: string } | null;

  if (savedFeeding) {
    await syncFeedingReminder(context, savedFeeding.id, reminderAtIso);
  }

  revalidatePath("/", "layout");
}

export async function createQuestionAction(formData: FormData) {
  const context = await requireReadyContext();
  const parsed = questionInputSchema.parse({
    text: formData.get("text"),
    category: formData.get("category") ?? "other",
    professional: formData.get("professional") ?? "pediatrician",
    priority: formData.get("priority") ?? "normal"
  });

  const photoUrl = await resolvePhoto(context, "question", formData);

  const { error } = await context.supabase.from("questions").insert({
    baby_id: context.baby.id,
    family_id: context.familyId,
    created_by_user_id: context.user.id,
    text: parsed.text,
    category: parsed.category,
    professional: parsed.professional,
    priority: parsed.priority,
    photo_url: photoUrl ?? null,
    status: "pending",
    source: "manual"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
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

  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Edición y borrado de registros del timeline.
// Todas filtran por family_id + baby_id además del id: defensa en profundidad
// junto con las RLS de Supabase (que ya restringen a la familia del usuario).
// ---------------------------------------------------------------------------

export async function updateDiaperAction(formData: FormData) {
  const context = await requireReadyContext();
  const parsed = diaperEventEditSchema.parse({
    id: formData.get("id"),
    diaperType: formData.get("diaperType"),
    eventTime: formData.get("eventTime"),
    comment: optionalText(formData.get("comment")) ?? undefined,
    abnormalFlag: formData.get("abnormalFlag") === "on"
  });

  const photoUrl = await resolvePhoto(context, "diaper", formData);

  const { error } = await context.supabase
    .from("diaper_events")
    .update({
      event_time: argentinaLocalInputToIso(parsed.eventTime),
      diaper_type: parsed.diaperType,
      comment: parsed.comment ?? null,
      abnormal_flag: parsed.abnormalFlag,
      // Solo tocamos la foto si cambió (path nuevo o null para quitar).
      ...(photoUrl !== undefined ? { photo_url: photoUrl } : {})
    })
    .eq("id", parsed.id)
    .eq("family_id", context.familyId)
    .eq("baby_id", context.baby.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
}

export async function deleteDiaperAction(formData: FormData) {
  const context = await requireReadyContext();
  const { id } = deleteByIdSchema.parse({ id: formData.get("id") });

  const { error } = await context.supabase
    .from("diaper_events")
    .delete()
    .eq("id", id)
    .eq("family_id", context.familyId)
    .eq("baby_id", context.baby.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
}

export async function updateFeedingAction(formData: FormData) {
  const context = await requireReadyContext();
  const parsed = feedingEventEditSchema.parse({
    id: formData.get("id"),
    startedAt: formData.get("startedAt"),
    leftBreastUsed: formData.get("leftBreastUsed") === "on",
    rightBreastUsed: formData.get("rightBreastUsed") === "on",
    leftBreastMinutes: formData.get("leftBreastMinutes"),
    rightBreastMinutes: formData.get("rightBreastMinutes"),
    notes: optionalText(formData.get("notes")) ?? undefined,
    reminderOption: formData.get("reminderOption") ?? "2h30",
    customReminderAt: formData.get("customReminderAt")
  });

  const startedAtIso = argentinaLocalInputToIso(parsed.startedAt);
  const { reminderAtIso, reminderOption } = resolveFeedingReminder(parsed);

  const { error } = await context.supabase
    .from("feeding_events")
    .update({
      started_at: startedAtIso,
      left_breast_used: parsed.leftBreastUsed || Boolean(parsed.leftBreastMinutes),
      right_breast_used: parsed.rightBreastUsed || Boolean(parsed.rightBreastMinutes),
      left_breast_minutes: parsed.leftBreastMinutes ?? null,
      right_breast_minutes: parsed.rightBreastMinutes ?? null,
      notes: parsed.notes ?? null,
      reminder_option: reminderOption,
      reminder_at: reminderAtIso
    })
    .eq("id", parsed.id)
    .eq("family_id", context.familyId)
    .eq("baby_id", context.baby.id);

  if (error) {
    throw new Error(error.message);
  }

  // Reflejamos el cambio en la alarma programada de esta toma.
  await syncFeedingReminder(context, parsed.id, reminderAtIso);

  revalidatePath("/", "layout");
}

export async function deleteFeedingAction(formData: FormData) {
  const context = await requireReadyContext();
  const { id } = deleteByIdSchema.parse({ id: formData.get("id") });

  // Primero la alarma asociada (no hay FK que la borre en cascada), luego la toma.
  await syncFeedingReminder(context, id, null);

  const { error } = await context.supabase
    .from("feeding_events")
    .delete()
    .eq("id", id)
    .eq("family_id", context.familyId)
    .eq("baby_id", context.baby.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
}

export async function updateQuestionAction(formData: FormData) {
  const context = await requireReadyContext();
  const parsed = questionEditSchema.parse({
    id: formData.get("id"),
    text: formData.get("text"),
    category: formData.get("category") ?? "other",
    professional: formData.get("professional") ?? "pediatrician",
    priority: formData.get("priority") ?? "normal"
  });

  const photoUrl = await resolvePhoto(context, "question", formData);

  const { error } = await context.supabase
    .from("questions")
    .update({
      text: parsed.text,
      category: parsed.category,
      professional: parsed.professional,
      priority: parsed.priority,
      ...(photoUrl !== undefined ? { photo_url: photoUrl } : {})
    })
    .eq("id", parsed.id)
    .eq("family_id", context.familyId)
    .eq("baby_id", context.baby.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
}

export async function deleteQuestionAction(formData: FormData) {
  const context = await requireReadyContext();
  const { id } = deleteByIdSchema.parse({ id: formData.get("id") });

  const { error } = await context.supabase
    .from("questions")
    .delete()
    .eq("id", id)
    .eq("family_id", context.familyId)
    .eq("baby_id", context.baby.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Álbum del bebé (Fase 4).
// ---------------------------------------------------------------------------

export async function createBabyPhotoAction(formData: FormData) {
  const context = await requireReadyContext();
  const parsed = babyPhotoInputSchema.parse({
    takenAt: formData.get("takenAt"),
    note: optionalText(formData.get("note")) ?? undefined
  });

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("Hace falta una foto para agregar al álbum.");
  }
  const photoUrl = await uploadPhoto(context, "album", photo);

  const { error } = await context.supabase.from("baby_photos").insert({
    baby_id: context.baby.id,
    family_id: context.familyId,
    created_by_user_id: context.user.id,
    taken_at: parsed.takenAt ? argentinaLocalInputToIso(parsed.takenAt) : new Date().toISOString(),
    photo_url: photoUrl,
    note: parsed.note ?? null,
    source: "manual"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
}

export async function deleteBabyPhotoAction(formData: FormData) {
  const context = await requireReadyContext();
  const { id } = deleteByIdSchema.parse({ id: formData.get("id") });

  // Buscamos el path para borrar también el objeto de Storage (evitar huérfanos).
  const { data: row } = await context.supabase
    .from("baby_photos")
    .select("photo_url")
    .eq("id", id)
    .eq("family_id", context.familyId)
    .eq("baby_id", context.baby.id)
    .maybeSingle();

  const { error } = await context.supabase
    .from("baby_photos")
    .delete()
    .eq("id", id)
    .eq("family_id", context.familyId)
    .eq("baby_id", context.baby.id);

  if (error) {
    throw new Error(error.message);
  }

  const photoPath = (row as { photo_url: string } | null)?.photo_url;
  if (photoPath) {
    // Best-effort: si falla el borrado del objeto, el registro ya no existe.
    await context.supabase.storage.from(MEDIA_BUCKET).remove([photoPath]);
  }

  revalidatePath("/", "layout");
}

export async function updateBabyAction(formData: FormData) {
  const context = await requireReadyContext();
  const parsed = babyEditSchema.parse({
    name: formData.get("name"),
    birthDate: formData.get("birthDate")
  });

  const { error } = await context.supabase
    .from("babies")
    .update({ name: parsed.name, birth_date: parsed.birthDate })
    .eq("id", context.baby.id)
    .eq("family_id", context.familyId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
}

export async function confirmVoiceEventAction(
  result: VoiceParseResult
): Promise<{ ok: true } | { ok: false; error: string }> {
  const context = await requireReadyContext();

  if (result.proposedEvent.intent === "unknown" || result.intent === "unknown") {
    return { ok: false, error: "No se puede guardar un audio que no fue interpretado." };
  }

  try {
    await saveProposedVoiceEvent(context, result);
    await recordVoiceParseLog(context, result, { accepted: true });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Error desconocido al guardar el evento de voz.";
    // El log es best-effort: si falla, NO debe tapar el error real del guardado.
    await recordVoiceParseLog(context, result, { accepted: false, error: message });
    // Devolvemos el error como DATO, no con throw: en producción Next censura los
    // mensajes que escapan de un Server Action (el usuario veía un texto genérico
    // de "Server Components render"). Así el cliente muestra el motivo real.
    return { ok: false, error: message };
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
    // El servidor ya resolvió la opción (custom/preset/none/default); si por
    // alguna razón viniera vacía, caemos al default, no a "sin alarma".
    const reminderOption = proposedEvent.reminderOption ?? DEFAULT_FEEDING_REMINDER;
    // Para 'custom' la hora viene explícita en reminderAtLocal (la calculó el
    // LLM, ej. "en 2 horas"); para los presets la derivamos del inicio.
    const reminderAt =
      reminderOption === "custom" && proposedEvent.reminderAtLocal
        ? argentinaLocalInputToIso(proposedEvent.reminderAtLocal)
        : calculateReminderAt(startedAtIso, reminderOption);

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

    if (savedFeeding) {
      await syncFeedingReminder(context, savedFeeding.id, reminderAt);
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
