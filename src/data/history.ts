import { getArgentinaDayRange, toArgentinaDateTimeLocal } from "@/src/domain/time";
import type { DiaperEvent, FeedingEvent, Question } from "@/src/domain/types";

import type { ReadyFamilyContext } from "./context";
import {
  mapDiaper,
  mapFeeding,
  mapQuestion,
  type DiaperRow,
  type FeedingRow,
  type QuestionRow
} from "./today";

/** Cuántos días hacia atrás traemos en el histórico (sin contar hoy). */
const HISTORY_DAYS = 30;

/** Eventos de un día (clave YYYY-MM-DD en hora de Argentina). */
export type DayGroup<T> = { dayKey: string; events: T[] };

/** Día (YYYY-MM-DD, hora AR) de un timestamp ISO. */
function dayKeyOf(iso: string): string {
  return toArgentinaDateTimeLocal(new Date(iso)).slice(0, 10);
}

/** Agrupa por día preservando el orden de entrada (si viene desc, queda desc). */
function groupByDay<T>(events: T[], timeOf: (event: T) => string): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const event of events) {
    const key = dayKeyOf(timeOf(event));
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }
  return [...map.entries()].map(([dayKey, list]) => ({ dayKey, events: list }));
}

/** Rango [desde, inicioDeHoy): los últimos HISTORY_DAYS días, sin incluir hoy. */
function pastRange() {
  const { startIso } = getArgentinaDayRange();
  const sinceIso = new Date(
    new Date(startIso).getTime() - HISTORY_DAYS * 86_400_000
  ).toISOString();
  return { sinceIso, beforeIso: startIso };
}

export async function getDiaperHistory(
  context: ReadyFamilyContext
): Promise<DayGroup<DiaperEvent>[]> {
  const { sinceIso, beforeIso } = pastRange();
  const { data, error } = await context.supabase
    .from("diaper_events")
    .select("*")
    .eq("baby_id", context.baby.id)
    .eq("family_id", context.familyId)
    .gte("event_time", sinceIso)
    .lt("event_time", beforeIso)
    .order("event_time", { ascending: false });

  if (error) throw new Error(error.message);

  const events = (data ?? []).map((row) => mapDiaper(row as DiaperRow));
  return groupByDay(events, (event) => event.eventTime);
}

export async function getFeedingHistory(
  context: ReadyFamilyContext
): Promise<DayGroup<FeedingEvent>[]> {
  const { sinceIso, beforeIso } = pastRange();
  const { data, error } = await context.supabase
    .from("feeding_events")
    .select("*")
    .eq("baby_id", context.baby.id)
    .eq("family_id", context.familyId)
    .gte("started_at", sinceIso)
    .lt("started_at", beforeIso)
    .order("started_at", { ascending: false });

  if (error) throw new Error(error.message);

  const events = (data ?? []).map((row) => mapFeeding(row as FeedingRow));
  return groupByDay(events, (event) => event.startedAt);
}

/**
 * Dudas ya respondidas (el "histórico" de la sección). Las pendientes se
 * muestran siempre arriba, sin importar el día, así que no van acá.
 */
export async function getAnsweredQuestions(
  context: ReadyFamilyContext
): Promise<Question[]> {
  const { data, error } = await context.supabase
    .from("questions")
    .select("*")
    .eq("baby_id", context.baby.id)
    .eq("family_id", context.familyId)
    .eq("status", "answered")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapQuestion(row as QuestionRow));
}
