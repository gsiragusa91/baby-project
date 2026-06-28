import { DIAPER_LABELS } from "@/src/domain/labels";
import { formatArgentinaTime, getArgentinaDayRange, toArgentinaDateTimeLocal } from "@/src/domain/time";
import type {
  DiaperEvent,
  FeedingEvent,
  Question,
  Reminder,
  TimelineItem,
  TodaySummary
} from "@/src/domain/types";

import { signedUrlsFor } from "@/src/lib/supabase/storage";

import type { ReadyFamilyContext } from "./context";

type DiaperRow = {
  id: string;
  baby_id: string;
  family_id: string;
  created_by_user_id: string;
  created_at: string;
  event_time: string;
  diaper_type: DiaperEvent["diaperType"];
  comment: string | null;
  photo_url: string | null;
  abnormal_flag: boolean;
  source: DiaperEvent["source"];
  transcript: string | null;
};

type FeedingRow = {
  id: string;
  baby_id: string;
  family_id: string;
  created_by_user_id: string;
  created_at: string;
  started_at: string;
  ended_at: string | null;
  left_breast_used: boolean | null;
  right_breast_used: boolean | null;
  left_breast_minutes: number | null;
  right_breast_minutes: number | null;
  notes: string | null;
  reminder_option: FeedingEvent["reminderOption"];
  reminder_at: string | null;
  source: FeedingEvent["source"];
  transcript: string | null;
};

type QuestionRow = {
  id: string;
  baby_id: string;
  family_id: string;
  created_by_user_id: string;
  created_at: string;
  text: string;
  category: Question["category"];
  professional: Question["professional"];
  status: Question["status"];
  priority: Question["priority"];
  answer: string | null;
  photo_url: string | null;
  source: Question["source"];
  transcript: string | null;
};

type ReminderRow = {
  id: string;
  baby_id: string;
  family_id: string;
  created_by_user_id: string;
  created_at: string;
  related_event_type: Reminder["relatedEventType"];
  related_event_id: string | null;
  remind_at: string;
  status: Reminder["status"];
  channel: Reminder["channel"];
};

function mapDiaper(row: DiaperRow): DiaperEvent {
  return {
    id: row.id,
    babyId: row.baby_id,
    familyId: row.family_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    eventTime: row.event_time,
    diaperType: row.diaper_type,
    comment: row.comment,
    photoUrl: row.photo_url,
    abnormalFlag: row.abnormal_flag,
    source: row.source,
    transcript: row.transcript
  };
}

function mapFeeding(row: FeedingRow): FeedingEvent {
  return {
    id: row.id,
    babyId: row.baby_id,
    familyId: row.family_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    leftBreastUsed: row.left_breast_used,
    rightBreastUsed: row.right_breast_used,
    leftBreastMinutes: row.left_breast_minutes,
    rightBreastMinutes: row.right_breast_minutes,
    notes: row.notes,
    reminderOption: row.reminder_option,
    reminderAt: row.reminder_at,
    source: row.source,
    transcript: row.transcript
  };
}

function mapQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    babyId: row.baby_id,
    familyId: row.family_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    text: row.text,
    category: row.category,
    professional: row.professional,
    status: row.status,
    priority: row.priority,
    answer: row.answer,
    photoUrl: row.photo_url,
    source: row.source,
    transcript: row.transcript
  };
}

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    babyId: row.baby_id,
    familyId: row.family_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    relatedEventType: row.related_event_type,
    relatedEventId: row.related_event_id,
    remindAt: row.remind_at,
    status: row.status,
    channel: row.channel
  };
}

function buildTimeline(diapers: DiaperEvent[], feedings: FeedingEvent[], questions: Question[]) {
  const diaperItems: TimelineItem[] = diapers.map((event) => ({
    id: event.id,
    type: "diaper",
    title: "Pañal",
    detail: DIAPER_LABELS[event.diaperType],
    time: event.eventTime
  }));

  const feedingItems: TimelineItem[] = feedings.map((event) => ({
    id: event.id,
    type: "feeding",
    title: "Lactancia",
    detail: [event.leftBreastMinutes ? `Izq ${event.leftBreastMinutes} min` : null, event.rightBreastMinutes ? `Der ${event.rightBreastMinutes} min` : null]
      .filter(Boolean)
      .join(" · ") || "Registrada",
    time: event.startedAt
  }));

  const questionItems: TimelineItem[] = questions.map((event) => ({
    id: event.id,
    type: "question",
    title: "Duda",
    detail: event.text,
    time: event.createdAt
  }));

  return [...diaperItems, ...feedingItems, ...questionItems]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 8);
}

export async function getTodaySummary(context: ReadyFamilyContext): Promise<TodaySummary> {
  const { startIso, endIso } = getArgentinaDayRange();
  const { supabase, baby, familyId } = context;

  const [diapersResult, feedingsResult, questionsResult, remindersResult] = await Promise.all([
    supabase
      .from("diaper_events")
      .select("*")
      .eq("baby_id", baby.id)
      .eq("family_id", familyId)
      .gte("event_time", startIso)
      .lt("event_time", endIso)
      .order("event_time", { ascending: false }),
    supabase
      .from("feeding_events")
      .select("*")
      .eq("baby_id", baby.id)
      .eq("family_id", familyId)
      .gte("started_at", startIso)
      .lt("started_at", endIso)
      .order("started_at", { ascending: false }),
    supabase
      .from("questions")
      .select("*")
      .eq("baby_id", baby.id)
      .eq("family_id", familyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("reminders")
      .select("*")
      .eq("baby_id", baby.id)
      .eq("family_id", familyId)
      .eq("status", "scheduled")
      .gte("remind_at", new Date().toISOString())
      .order("remind_at", { ascending: true })
      .limit(1)
  ]);

  for (const result of [diapersResult, feedingsResult, questionsResult, remindersResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const diapers = (diapersResult.data ?? []).map((row) => mapDiaper(row as DiaperRow));
  const feedings = (feedingsResult.data ?? []).map((row) => mapFeeding(row as FeedingRow));
  const pendingQuestions = (questionsResult.data ?? []).map((row) => mapQuestion(row as QuestionRow));
  const reminders = (remindersResult.data ?? []).map((row) => mapReminder(row as ReminderRow));

  // Una sola llamada a Storage para todas las fotos del día (pañales + dudas).
  const signedUrls = await signedUrlsFor(context, [
    ...diapers.map((d) => d.photoUrl),
    ...pendingQuestions.map((q) => q.photoUrl)
  ]);
  for (const diaper of diapers) {
    diaper.photoSignedUrl = diaper.photoUrl ? signedUrls.get(diaper.photoUrl) ?? null : null;
  }
  for (const question of pendingQuestions) {
    question.photoSignedUrl = question.photoUrl ? signedUrls.get(question.photoUrl) ?? null : null;
  }

  return {
    baby,
    nowLocal: toArgentinaDateTimeLocal(),
    counts: {
      diapers: diapers.length,
      feedings: feedings.length,
      pendingQuestions: pendingQuestions.length
    },
    lastDiaper: diapers[0],
    lastFeeding: feedings[0],
    nextReminder: reminders[0],
    pendingQuestions,
    diapers,
    feedings,
    timeline: buildTimeline(diapers, feedings, pendingQuestions).map((item) => ({
      ...item,
      detail: item.detail.length > 80 ? `${item.detail.slice(0, 77)}...` : item.detail,
      title: `${item.title} · ${formatArgentinaTime(item.time)}`
    }))
  };
}
