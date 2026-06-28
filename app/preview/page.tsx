import { AppShell } from "@/src/components/app-shell";
import { InicioScreen } from "@/src/components/inicio-screen";
import type { TodaySummary } from "@/src/domain/types";

/**
 * Ruta de PREVIEW solo para revisar el design system sin Supabase.
 * Datos mockeados. No persiste nada: si apretás "Guardar" las server
 * actions van a fallar (no hay backend). Es solo para mirar la piel.
 * Borrable cuando Supabase esté configurado.
 */
const mockSummary: TodaySummary = {
  baby: {
    id: "mock-baby",
    name: "Pacha",
    birthDate: "2026-06-01",
    createdAt: "2026-06-01T00:00:00-03:00",
    familyId: "mock-family"
  },
  nowLocal: "2026-06-24T12:25",
  counts: {
    diapers: 5,
    feedings: 4,
    pendingQuestions: 3
  },
  lastDiaper: {
    id: "d1",
    babyId: "mock-baby",
    familyId: "mock-family",
    createdByUserId: "u1",
    createdAt: "2026-06-24T04:05:00-03:00",
    eventTime: "2026-06-24T04:05:00-03:00",
    diaperType: "pee_poop",
    abnormalFlag: false,
    source: "manual"
  },
  lastFeeding: {
    id: "f1",
    babyId: "mock-baby",
    familyId: "mock-family",
    createdByUserId: "u1",
    createdAt: "2026-06-24T03:10:00-03:00",
    startedAt: "2026-06-24T03:10:00-03:00",
    leftBreastUsed: true,
    rightBreastUsed: true,
    leftBreastMinutes: 12,
    rightBreastMinutes: 8,
    reminderOption: "2h30",
    reminderAt: "2026-06-24T05:40:00-03:00",
    source: "manual"
  },
  nextReminder: {
    id: "r1",
    babyId: "mock-baby",
    familyId: "mock-family",
    createdByUserId: "u1",
    createdAt: "2026-06-24T03:10:00-03:00",
    relatedEventType: "feeding",
    relatedEventId: "f1",
    remindAt: "2026-06-24T05:40:00-03:00",
    status: "scheduled",
    channel: "none"
  },
  pendingQuestions: [
    {
      id: "q1",
      babyId: "mock-baby",
      familyId: "mock-family",
      createdByUserId: "u1",
      createdAt: "2026-06-24T06:00:00-03:00",
      text: "¿Es normal que tenga hipo después de tomar?",
      category: "feeding",
      professional: "pediatrician",
      status: "pending",
      priority: "normal",
      source: "manual"
    },
    {
      id: "q2",
      babyId: "mock-baby",
      familyId: "mock-family",
      createdByUserId: "u1",
      createdAt: "2026-06-24T07:30:00-03:00",
      text: "¿Cuándo se cae el cordón umbilical?",
      category: "umbilical_cord",
      professional: "neonatologist",
      status: "pending",
      priority: "next_visit",
      source: "manual"
    }
  ],
  timeline: [
    { id: "f1", type: "feeding", title: "Lactancia", detail: "Izq 12 min · Der 8 min", time: "03:10" },
    { id: "d1", type: "diaper", title: "Pañal", detail: "Pis + caca", time: "04:05" },
    { id: "q1", type: "question", title: "Duda", detail: "¿Es normal el hipo después de tomar?", time: "06:00" }
  ],
  diapers: [
    {
      id: "d1",
      babyId: "mock-baby",
      familyId: "mock-family",
      createdByUserId: "u1",
      createdAt: "2026-06-24T04:05:00-03:00",
      eventTime: "2026-06-24T04:05:00-03:00",
      diaperType: "pee_poop",
      abnormalFlag: false,
      source: "manual"
    }
  ],
  feedings: [
    {
      id: "f1",
      babyId: "mock-baby",
      familyId: "mock-family",
      createdByUserId: "u1",
      createdAt: "2026-06-24T03:10:00-03:00",
      startedAt: "2026-06-24T03:10:00-03:00",
      leftBreastUsed: true,
      rightBreastUsed: true,
      leftBreastMinutes: 12,
      rightBreastMinutes: 8,
      reminderOption: "2h30",
      reminderAt: "2026-06-24T05:40:00-03:00",
      source: "manual"
    }
  ]
};

export default function PreviewPage() {
  return (
    <AppShell babyName={mockSummary.baby.name} email="preview@babys.app" voiceParser="mock">
      <InicioScreen summary={mockSummary} />
    </AppShell>
  );
}
