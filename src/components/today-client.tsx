"use client";

import {
  Baby,
  Check,
  CircleHelp,
  Droplets,
  LogOut,
  Milk,
  ShieldAlert,
  UserPlus
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { VoiceButton } from "./voice-button";

import {
  confirmVoiceEventAction,
  createDiaperAction,
  createFeedingAction,
  createQuestionAction,
  markQuestionAnsweredAction,
  signOutAction
} from "@/app/actions";
import {
  CATEGORY_LABELS,
  DIAPER_LABELS,
  PRIORITY_LABELS,
  PROFESSIONAL_LABELS,
  REMINDER_LABELS
} from "@/src/domain/labels";
import { formatArgentinaTime } from "@/src/domain/time";
import type { VoiceParseResult } from "@/src/domain/voice.ts";
import type { DiaperType, TodaySummary } from "@/src/domain/types";

type Panel = "diaper" | "feeding" | "question" | null;

/** Simula POST /api/voice/parse para el preview (sin backend real). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function mockVoiceParse(_blob: Blob): Promise<VoiceParseResult> {
  await new Promise((r) => setTimeout(r, 1500));
  return {
    transcript: "Arrancó lactancia a las tres y diez, izquierda doce minutos, derecha ocho, alarma en dos horas y media.",
    intent: "register_feeding",
    confidence: 0.94,
    warnings: [],
    needsConfirmation: true,
    proposedEvent: {
      intent: "register_feeding",
      startedAtLocal: "2026-06-24T03:10",
      leftBreastUsed: true,
      rightBreastUsed: true,
      leftBreastMinutes: 12,
      rightBreastMinutes: 8,
      reminderOption: "2h30",
      reminderAtLocal: "2026-06-24T05:40"
    }
  };
}

/** Extensión de archivo según el mimeType real del audio (OpenAI la usa para decodificar). */
function audioFileName(blob: Blob) {
  const type = blob.type;
  const ext = type.includes("mp4")
    ? "mp4"
    : type.includes("ogg")
      ? "ogg"
      : type.includes("wav")
        ? "wav"
        : type.includes("mpeg")
          ? "mp3"
          : "webm";
  return `voice.${ext}`;
}

async function postVoiceParse(blob: Blob): Promise<VoiceParseResult> {
  const formData = new FormData();
  formData.append("audio", blob, audioFileName(blob));

  const response = await fetch("/api/voice/parse", {
    method: "POST",
    body: formData
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "No pude procesar el audio. Intentá de nuevo."
    );
  }

  return body as VoiceParseResult;
}

type TodayClientProps = {
  summary: TodaySummary;
  userEmail: string;
  voiceParser?: "api" | "mock";
};

const diaperTypes: DiaperType[] = ["pee", "poop", "pee_poop", "dry"];

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function PillAction({
  active,
  children,
  label,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={[
        "tap-target flex flex-col items-center justify-center rounded-full px-3 text-[10px] font-bold transition-colors",
        active ? "text-[var(--primary)]" : "text-[var(--ink-soft)]"
      ].join(" ")}
      type="button"
      onClick={onClick}
    >
      {children}
      <span className="mt-0.5">{label}</span>
    </button>
  );
}

function DiaperForm({ nowLocal }: { nowLocal: string }) {
  return (
    <form action={createDiaperAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {diaperTypes.map((type) => (
          <label
            className="tap-target flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-center text-sm font-bold"
            key={type}
          >
            <input
              className="sr-only peer"
              name="diaperType"
              type="radio"
              value={type}
              defaultChecked={type === "pee"}
            />
            <span className="peer-checked:text-[var(--diaper)]">
              {DIAPER_LABELS[type]}
            </span>
          </label>
        ))}
      </div>
      <input
        className="field"
        name="eventTime"
        type="datetime-local"
        defaultValue={nowLocal}
        required
      />
      <textarea
        className="field min-h-24 resize-none"
        name="comment"
        placeholder="Comentario"
      />
      <label className="flex tap-target items-center gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold">
        <input name="abnormalFlag" type="checkbox" />
        <ShieldAlert size={20} />
        Marcar para revisar
      </label>
      <button
        className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
        type="submit"
      >
        Guardar pañal
      </button>
    </form>
  );
}

function FeedingForm({ nowLocal }: { nowLocal: string }) {
  return (
    <form action={createFeedingAction} className="space-y-4">
      <input
        className="field"
        name="startedAt"
        type="datetime-local"
        defaultValue={nowLocal}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <input name="leftBreastUsed" type="checkbox" defaultChecked />
            Izquierda
          </span>
          <input
            className="field mt-3"
            name="leftBreastMinutes"
            type="number"
            min="0"
            max="240"
            inputMode="numeric"
            placeholder="min"
          />
        </label>
        <label className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <input name="rightBreastUsed" type="checkbox" />
            Derecha
          </span>
          <input
            className="field mt-3"
            name="rightBreastMinutes"
            type="number"
            min="0"
            max="240"
            inputMode="numeric"
            placeholder="min"
          />
        </label>
      </div>
      <select className="field" name="reminderOption" defaultValue="2h30">
        {Object.entries(REMINDER_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <textarea
        className="field min-h-24 resize-none"
        name="notes"
        placeholder="Notas"
      />
      <button
        className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
        type="submit"
      >
        Guardar lactancia
      </button>
    </form>
  );
}

function QuestionForm() {
  return (
    <form action={createQuestionAction} className="space-y-4">
      <textarea
        className="field min-h-28 resize-none"
        name="text"
        placeholder="Duda"
        required
      />
      <select className="field" name="category" defaultValue="feeding">
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select className="field" name="professional" defaultValue="pediatrician">
        {Object.entries(PROFESSIONAL_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select className="field" name="priority" defaultValue="normal">
        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button
        className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
        type="submit"
      >
        Guardar duda
      </button>
    </form>
  );
}

function ActivePanel({ panel, nowLocal }: { panel: Panel; nowLocal: string }) {
  if (!panel) {
    return null;
  }

  return (
    <section className="sheet px-5 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {panel === "diaper" ? "Pañal" : panel === "feeding" ? "Lactancia" : "Duda"}
        </h2>
      </div>
      {panel === "diaper" ? <DiaperForm nowLocal={nowLocal} /> : null}
      {panel === "feeding" ? <FeedingForm nowLocal={nowLocal} /> : null}
      {panel === "question" ? <QuestionForm /> : null}
    </section>
  );
}

export function TodayClient({
  summary,
  userEmail,
  voiceParser = "api"
}: TodayClientProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const submitVoiceAudio = voiceParser === "mock" ? mockVoiceParse : postVoiceParse;
  const confirmVoiceEvent =
    voiceParser === "mock"
      ? async () => {}
      : async (result: VoiceParseResult) => {
          await confirmVoiceEventAction(result);
          router.refresh();
        };

  return (
    <main className="mobile-shell flex min-h-svh flex-col">
      <header className="px-5 pb-4 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
              Hoy
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold">
              <Baby size={28} />
              {summary.baby.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              aria-label="Invitar"
              className="tap-target flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] p-3"
              href="/family"
            >
              <UserPlus size={20} />
            </Link>
            <form action={signOutAction}>
              <button
                aria-label="Salir"
                className="tap-target rounded-full border border-[var(--line)] bg-[var(--surface)] p-3"
                type="submit"
              >
                <LogOut size={20} />
              </button>
            </form>
          </div>
        </div>
        <p className="mt-3 truncate text-sm text-[var(--ink-soft)]">{userEmail}</p>
      </header>

      <section className="grid grid-cols-3 gap-3 px-5">
        <Metric label="Pañales" value={summary.counts.diapers} />
        <Metric label="Tomas" value={summary.counts.feedings} />
        <Metric label="Dudas" value={summary.counts.pendingQuestions} />
      </section>

      <section className="mt-5 space-y-3 px-5">
        <div className="rounded-[var(--radius-lg)] bg-[var(--feed-tint)] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
            Última toma
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--feed)]">
            {summary.lastFeeding ? formatArgentinaTime(summary.lastFeeding.startedAt) : "--:--"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-lg)] bg-[var(--sleep-tint)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
              Próxima
            </p>
            <p className="mt-1 text-xl font-bold text-[var(--sleep)]">
              {summary.nextReminder ? formatArgentinaTime(summary.nextReminder.remindAt) : "--:--"}
            </p>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-[var(--diaper-tint)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
              Último pañal
            </p>
            <p className="mt-1 text-xl font-bold text-[var(--diaper)]">
              {summary.lastDiaper ? DIAPER_LABELS[summary.lastDiaper.diaperType] : "--"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 flex-1 px-5 pb-4">
        <h2 className="text-xl font-bold">Timeline</h2>
        <div className="mt-3 space-y-3">
          {summary.timeline.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm font-semibold text-[var(--ink-soft)]">
              Sin registros todavía
            </p>
          ) : (
            summary.timeline.map((item) => (
              <div
                className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3"
                key={`${item.type}-${item.id}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)]">
                  {item.type === "diaper" ? <Droplets size={19} className="text-[var(--diaper)]" /> : null}
                  {item.type === "feeding" ? <Milk size={19} className="text-[var(--feed)]" /> : null}
                  {item.type === "question" ? <CircleHelp size={19} className="text-[var(--sleep)]" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-soft)]">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {summary.pendingQuestions.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-xl font-bold">Dudas pendientes</h2>
            <div className="mt-3 space-y-3">
              {summary.pendingQuestions.slice(0, 3).map((question) => (
                <form
                  action={markQuestionAnsweredAction}
                  className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3"
                  key={question.id}
                >
                  <input name="questionId" type="hidden" value={question.id} />
                  <p className="flex-1 text-sm font-semibold leading-5">{question.text}</p>
                  <button
                    aria-label="Marcar respondida"
                    className="tap-target rounded-full bg-[var(--diaper-tint)] p-3 text-[var(--diaper)]"
                    type="submit"
                  >
                    <Check size={18} />
                  </button>
                </form>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <ActivePanel panel={panel} nowLocal={summary.nowLocal} />

      {/* Nav flotante: pill con las acciones manuales + mic de VOZ SEPARADO a la
          derecha (zona del pulgar). El mic se distingue por chip candy + glow y un
          toque más de tamaño (Mix V2+V3). items-center alinea ambos elementos. */}
      <nav className="pointer-events-none sticky bottom-0 z-20 mt-auto flex items-center justify-center gap-3 px-4 pb-5">
        {/* Pill — acciones manuales (secundarias) */}
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-[var(--line)] bg-[rgba(33,29,46,0.85)] px-2 py-1.5 backdrop-blur-xl"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}
        >
          <PillAction
            active={panel === "diaper"}
            label="Pañal"
            onClick={() => setPanel(panel === "diaper" ? null : "diaper")}
          >
            <Droplets size={20} />
          </PillAction>
          <PillAction
            active={panel === "feeding"}
            label="Toma"
            onClick={() => setPanel(panel === "feeding" ? null : "feeding")}
          >
            <Milk size={20} />
          </PillAction>
          <PillAction
            active={panel === "question"}
            label="Duda"
            onClick={() => setPanel(panel === "question" ? null : "question")}
          >
            <CircleHelp size={20} />
          </PillAction>
        </div>

        {/* Voz — protagonista, separada, a la derecha (zona del pulgar) */}
        <div className="pointer-events-auto">
          <VoiceButton
            onConfirm={confirmVoiceEvent}
            onSubmitAudio={submitVoiceAudio}
          />
        </div>
      </nav>
    </main>
  );
}
