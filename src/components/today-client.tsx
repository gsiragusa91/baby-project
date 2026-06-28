"use client";

import {
  Baby,
  Check,
  CircleHelp,
  Droplets,
  LogOut,
  Milk,
  Pencil,
  ShieldAlert,
  Trash2,
  UserPlus,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PushSetup } from "./push-setup";
import { VoiceButton } from "./voice-button";

import {
  confirmVoiceEventAction,
  createDiaperAction,
  createFeedingAction,
  createQuestionAction,
  deleteDiaperAction,
  deleteFeedingAction,
  deleteQuestionAction,
  markQuestionAnsweredAction,
  signOutAction,
  updateDiaperAction,
  updateFeedingAction,
  updateQuestionAction
} from "@/app/actions";
import {
  CATEGORY_LABELS,
  DIAPER_LABELS,
  PRIORITY_LABELS,
  PROFESSIONAL_LABELS,
  REMINDER_LABELS
} from "@/src/domain/labels";
import { DEFAULT_FEEDING_REMINDER } from "@/src/domain/reminders";
import { formatArgentinaTime, toArgentinaDateTimeLocal } from "@/src/domain/time";
import type { VoiceParseResult } from "@/src/domain/voice.ts";
import type {
  DiaperEvent,
  DiaperType,
  FeedingEvent,
  Professional,
  Question,
  QuestionCategory,
  QuestionPriority,
  ReminderOption,
  TodaySummary
} from "@/src/domain/types";

/** Valores iniciales de cada form. Las horas van en formato datetime-local
 * (YYYY-MM-DDTHH:mm), así el form no tiene que convertir nada. */
type DiaperInitial = {
  eventTimeLocal?: string;
  diaperType?: DiaperType;
  comment?: string | null;
  abnormalFlag?: boolean | null;
};

type FeedingInitial = {
  startedAtLocal?: string;
  leftBreastUsed?: boolean | null;
  rightBreastUsed?: boolean | null;
  leftBreastMinutes?: number | null;
  rightBreastMinutes?: number | null;
  notes?: string | null;
  reminderOption?: ReminderOption | null;
  customReminderAtLocal?: string | null;
};

type QuestionInitial = {
  text?: string;
  category?: QuestionCategory;
  professional?: Professional;
  priority?: QuestionPriority;
};

/** Estado del panel inferior: cerrado, o abierto para crear/editar un tipo.
 *  Si trae `editId` es edición; si no, es alta (con `initial` opcional para
 *  pre-cargar, p. ej. desde el resultado de voz). */
type PanelState =
  | null
  | { kind: "diaper"; editId?: string; initial?: DiaperInitial }
  | { kind: "feeding"; editId?: string; initial?: FeedingInitial }
  | { kind: "question"; editId?: string; initial?: QuestionInitial };

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
    // El backend manda `errorCode` (estable). Lo propagamos para que el botón
    // de voz lo traduzca con el catálogo; caemos a "unknown" si no vino.
    const error = new Error(
      typeof body?.error === "string" ? body.error : "No pude procesar el audio."
    ) as Error & { code?: string };
    error.code = typeof body?.errorCode === "string" ? body.errorCode : "unknown";
    throw error;
  }

  return body as VoiceParseResult;
}

/** ISO -> datetime-local en hora de Argentina, para pre-cargar inputs date. */
function isoToLocalInput(iso?: string | null) {
  return iso ? toArgentinaDateTimeLocal(new Date(iso)) : undefined;
}

/** Convierte el evento propuesto por voz en el estado del panel de alta,
 *  para que el usuario lo edite antes de guardar. Devuelve null si el intent
 *  no tiene un form (recordatorio suelto / no entendido). */
function proposedToPanel(result: VoiceParseResult): PanelState {
  const e = result.proposedEvent;

  if (e.intent === "register_diaper") {
    return {
      kind: "diaper",
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
      kind: "feeding",
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
      kind: "question",
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

/** Botón de borrado: form que postea la server action de delete con confirm. */
function DeleteButton({
  action,
  id,
  label
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("¿Eliminar este registro? No se puede deshacer.")) {
          e.preventDefault();
        }
      }}
    >
      <input name="id" type="hidden" value={id} />
      <button
        aria-label={label}
        className="tap-target flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-soft)] hover:text-[var(--danger)]"
        type="submit"
      >
        <Trash2 size={16} />
      </button>
    </form>
  );
}

function DiaperForm({
  nowLocal,
  initial,
  editId
}: {
  nowLocal: string;
  initial?: DiaperInitial;
  editId?: string;
}) {
  const checkedType = initial?.diaperType ?? "pee";
  return (
    <form action={editId ? updateDiaperAction : createDiaperAction} className="space-y-4">
      {editId ? <input name="id" type="hidden" value={editId} /> : null}
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
              defaultChecked={type === checkedType}
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
        defaultValue={initial?.eventTimeLocal ?? nowLocal}
        required
      />
      <textarea
        className="field min-h-24 resize-none"
        name="comment"
        placeholder="Comentario"
        defaultValue={initial?.comment ?? ""}
      />
      <label className="flex tap-target items-center gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold">
        <input name="abnormalFlag" type="checkbox" defaultChecked={Boolean(initial?.abnormalFlag)} />
        <ShieldAlert size={20} />
        Marcar para revisar
      </label>
      <button
        className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
        type="submit"
      >
        {editId ? "Guardar cambios" : "Guardar pañal"}
      </button>
    </form>
  );
}

function FeedingForm({
  nowLocal,
  initial,
  editId
}: {
  nowLocal: string;
  initial?: FeedingInitial;
  editId?: string;
}) {
  // El <select> muestra el preset si lo había; "custom" se maneja con el campo
  // de hora exacta de abajo (que, si está completo, manda sobre el preset).
  const presetDefault =
    initial?.reminderOption && initial.reminderOption !== "custom"
      ? initial.reminderOption
      : DEFAULT_FEEDING_REMINDER;

  return (
    <form action={editId ? updateFeedingAction : createFeedingAction} className="space-y-4">
      {editId ? <input name="id" type="hidden" value={editId} /> : null}
      <input
        className="field"
        name="startedAt"
        type="datetime-local"
        defaultValue={initial?.startedAtLocal ?? nowLocal}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <input
              name="leftBreastUsed"
              type="checkbox"
              defaultChecked={initial ? Boolean(initial.leftBreastUsed) : true}
            />
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
            defaultValue={initial?.leftBreastMinutes ?? ""}
          />
        </label>
        <label className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <input
              name="rightBreastUsed"
              type="checkbox"
              defaultChecked={Boolean(initial?.rightBreastUsed)}
            />
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
            defaultValue={initial?.rightBreastMinutes ?? ""}
          />
        </label>
      </div>
      <select className="field" name="reminderOption" defaultValue={presetDefault}>
        {Object.entries(REMINDER_LABELS)
          .filter(([value]) => value !== "custom")
          .map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
      </select>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
          O alarma a una hora exacta (opcional)
        </span>
        <input
          className="field mt-2"
          name="customReminderAt"
          type="datetime-local"
          defaultValue={initial?.customReminderAtLocal ?? ""}
        />
      </label>
      <textarea
        className="field min-h-24 resize-none"
        name="notes"
        placeholder="Notas"
        defaultValue={initial?.notes ?? ""}
      />
      <button
        className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
        type="submit"
      >
        {editId ? "Guardar cambios" : "Guardar lactancia"}
      </button>
    </form>
  );
}

function QuestionForm({
  initial,
  editId
}: {
  initial?: QuestionInitial;
  editId?: string;
}) {
  return (
    <form action={editId ? updateQuestionAction : createQuestionAction} className="space-y-4">
      {editId ? <input name="id" type="hidden" value={editId} /> : null}
      <textarea
        className="field min-h-28 resize-none"
        name="text"
        placeholder="Duda"
        defaultValue={initial?.text ?? ""}
        required
      />
      <select className="field" name="category" defaultValue={initial?.category ?? "feeding"}>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        className="field"
        name="professional"
        defaultValue={initial?.professional ?? "pediatrician"}
      >
        {Object.entries(PROFESSIONAL_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select className="field" name="priority" defaultValue={initial?.priority ?? "normal"}>
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
        {editId ? "Guardar cambios" : "Guardar duda"}
      </button>
    </form>
  );
}

function ActivePanel({
  panel,
  nowLocal,
  onClose
}: {
  panel: PanelState;
  nowLocal: string;
  onClose: () => void;
}) {
  if (!panel) {
    return null;
  }

  const isEdit = Boolean(panel.editId);
  const titleByKind = { diaper: "Pañal", feeding: "Lactancia", question: "Duda" };
  const title = `${isEdit ? "Editar" : ""} ${titleByKind[panel.kind]}`.trim();

  return (
    <section className="sheet px-5 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <button
          aria-label="Cerrar"
          className="tap-target rounded-full border border-[var(--line)] bg-[var(--surface)] p-2"
          type="button"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {panel.kind === "diaper" ? (
        <DiaperForm nowLocal={nowLocal} initial={panel.initial} editId={panel.editId} />
      ) : null}
      {panel.kind === "feeding" ? (
        <FeedingForm nowLocal={nowLocal} initial={panel.initial} editId={panel.editId} />
      ) : null}
      {panel.kind === "question" ? (
        <QuestionForm initial={panel.initial} editId={panel.editId} />
      ) : null}
    </section>
  );
}

export function TodayClient({
  summary,
  userEmail,
  voiceParser = "api"
}: TodayClientProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<PanelState>(null);
  const submitVoiceAudio = voiceParser === "mock" ? mockVoiceParse : postVoiceParse;
  const confirmVoiceEvent =
    voiceParser === "mock"
      ? async () => {}
      : async (result: VoiceParseResult) => {
          await confirmVoiceEventAction(result);
          router.refresh();
        };

  // Abre el panel correspondiente al item del timeline, pre-cargado para editar.
  function editTimelineItem(type: string, id: string) {
    if (type === "diaper") {
      const event = summary.diapers.find((d) => d.id === id);
      if (event) {
        setPanel({ kind: "diaper", editId: id, initial: diaperToInitial(event) });
      }
    } else if (type === "feeding") {
      const event = summary.feedings.find((f) => f.id === id);
      if (event) {
        setPanel({ kind: "feeding", editId: id, initial: feedingToInitial(event) });
      }
    } else if (type === "question") {
      const event = summary.pendingQuestions.find((q) => q.id === id);
      if (event) {
        setPanel({ kind: "question", editId: id, initial: questionToInitial(event) });
      }
    }
  }

  const deleteActionByType: Record<string, (fd: FormData) => Promise<void>> = {
    diaper: deleteDiaperAction,
    feeding: deleteFeedingAction,
    question: deleteQuestionAction
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

      <section className="px-5 pb-1">
        <PushSetup />
      </section>

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
                className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3"
                key={`${item.type}-${item.id}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)]">
                  {item.type === "diaper" ? <Droplets size={19} className="text-[var(--diaper)]" /> : null}
                  {item.type === "feeding" ? <Milk size={19} className="text-[var(--feed)]" /> : null}
                  {item.type === "question" ? <CircleHelp size={19} className="text-[var(--sleep)]" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-soft)]">
                    {item.detail}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    aria-label="Editar"
                    className="tap-target flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-soft)] hover:text-[var(--primary)]"
                    type="button"
                    onClick={() => editTimelineItem(item.type, item.id)}
                  >
                    <Pencil size={15} />
                  </button>
                  <DeleteButton
                    action={deleteActionByType[item.type]}
                    id={item.id}
                    label="Eliminar"
                  />
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

      <ActivePanel panel={panel} nowLocal={summary.nowLocal} onClose={() => setPanel(null)} />

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
            active={panel?.kind === "diaper"}
            label="Pañal"
            onClick={() => setPanel(panel?.kind === "diaper" ? null : { kind: "diaper" })}
          >
            <Droplets size={20} />
          </PillAction>
          <PillAction
            active={panel?.kind === "feeding"}
            label="Toma"
            onClick={() => setPanel(panel?.kind === "feeding" ? null : { kind: "feeding" })}
          >
            <Milk size={20} />
          </PillAction>
          <PillAction
            active={panel?.kind === "question"}
            label="Duda"
            onClick={() => setPanel(panel?.kind === "question" ? null : { kind: "question" })}
          >
            <CircleHelp size={20} />
          </PillAction>
        </div>

        {/* Voz — protagonista, separada, a la derecha (zona del pulgar) */}
        <div className="pointer-events-auto">
          <VoiceButton
            onConfirm={confirmVoiceEvent}
            onSubmitAudio={submitVoiceAudio}
            onEdit={(result) => {
              const next = proposedToPanel(result);
              if (next) setPanel(next);
            }}
          />
        </div>
      </nav>
    </main>
  );
}

// --- Mappers de evento del día -> valores iniciales del form de edición ---

function diaperToInitial(event: DiaperEvent): DiaperInitial {
  return {
    eventTimeLocal: isoToLocalInput(event.eventTime),
    diaperType: event.diaperType,
    comment: event.comment,
    abnormalFlag: event.abnormalFlag
  };
}

function feedingToInitial(event: FeedingEvent): FeedingInitial {
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

function questionToInitial(event: Question): QuestionInitial {
  return {
    text: event.text,
    category: event.category,
    professional: event.professional,
    priority: event.priority
  };
}
