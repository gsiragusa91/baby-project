"use client";

import { Check, Pencil, X } from "lucide-react";

import { DIAPER_LABELS, PROFESSIONAL_LABELS, REMINDER_LABELS } from "@/src/domain/labels";
import type { VoiceParseResult } from "@/src/domain/voice.ts";

type Props = {
  result: VoiceParseResult;
  onConfirm: () => void;
  onDiscard: () => void;
  /** Si se provee, habilita el botón "Editar" (abre el form pre-cargado). */
  onEdit?: () => void;
};

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-[var(--line)] last:border-0">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
        {label}
      </span>
      <span className="text-sm font-bold text-right">{value}</span>
    </div>
  );
}

function IntentBadge({ intent }: { intent: VoiceParseResult["intent"] }) {
  const map = {
    register_feeding: { label: "Lactancia", color: "var(--feed)", tint: "var(--feed-tint)" },
    register_diaper: { label: "Pañal", color: "var(--diaper)", tint: "var(--diaper-tint)" },
    create_question: { label: "Duda", color: "var(--sleep)", tint: "var(--sleep-tint)" },
    set_reminder: { label: "Recordatorio", color: "var(--primary)", tint: "var(--primary-tint)" },
    unknown: { label: "No entendí", color: "var(--danger)", tint: "var(--danger-tint)" }
  } as const;

  const { label, color, tint } = map[intent] ?? map.unknown;

  return (
    <span
      className="inline-block rounded-full px-3 py-1 text-xs font-bold"
      style={{ background: tint, color }}
    >
      {label}
    </span>
  );
}

function EventRows({ result }: { result: VoiceParseResult }) {
  const { proposedEvent } = result;

  if (proposedEvent.intent === "register_feeding") {
    return (
      <>
        {proposedEvent.startedAtLocal && (
          <ConfirmRow label="Inicio" value={proposedEvent.startedAtLocal.slice(11, 16)} />
        )}
        {proposedEvent.leftBreastUsed && proposedEvent.leftBreastMinutes != null && (
          <ConfirmRow label="Izquierda" value={`${proposedEvent.leftBreastMinutes} min`} />
        )}
        {proposedEvent.rightBreastUsed && proposedEvent.rightBreastMinutes != null && (
          <ConfirmRow label="Derecha" value={`${proposedEvent.rightBreastMinutes} min`} />
        )}
        {proposedEvent.reminderOption === "custom" && proposedEvent.reminderAtLocal ? (
          <ConfirmRow label="Recordatorio" value={proposedEvent.reminderAtLocal.slice(11, 16)} />
        ) : proposedEvent.reminderOption &&
          proposedEvent.reminderOption !== "none" &&
          proposedEvent.reminderOption !== "custom" ? (
          <ConfirmRow label="Recordatorio" value={REMINDER_LABELS[proposedEvent.reminderOption]} />
        ) : null}
        {proposedEvent.notes && (
          <ConfirmRow label="Nota" value={proposedEvent.notes} />
        )}
      </>
    );
  }

  if (proposedEvent.intent === "register_diaper") {
    return (
      <>
        {proposedEvent.eventTimeLocal && (
          <ConfirmRow label="Hora" value={proposedEvent.eventTimeLocal.slice(11, 16)} />
        )}
        {proposedEvent.diaperType && (
          <ConfirmRow label="Tipo" value={DIAPER_LABELS[proposedEvent.diaperType]} />
        )}
        {proposedEvent.comment && (
          <ConfirmRow label="Comentario" value={proposedEvent.comment} />
        )}
        {proposedEvent.abnormalFlag && (
          <ConfirmRow label="Revisar" value="Sí" />
        )}
      </>
    );
  }

  if (proposedEvent.intent === "create_question") {
    return (
      <>
        <ConfirmRow label="Texto" value={proposedEvent.text} />
        {proposedEvent.professional && (
          <ConfirmRow label="Para" value={PROFESSIONAL_LABELS[proposedEvent.professional]} />
        )}
      </>
    );
  }

  if (proposedEvent.intent === "set_reminder") {
    return (
      <>
        {proposedEvent.remindAtLocal ? (
          <ConfirmRow label="Recordatorio" value={proposedEvent.remindAtLocal.slice(11, 16)} />
        ) : proposedEvent.reminderOption &&
          proposedEvent.reminderOption !== "none" &&
          proposedEvent.reminderOption !== "custom" ? (
          <ConfirmRow label="En" value={REMINDER_LABELS[proposedEvent.reminderOption]} />
        ) : null}
      </>
    );
  }

  return (
    <p className="text-sm text-[var(--ink-soft)] py-2">{proposedEvent.reason}</p>
  );
}

export function VoiceConfirmationCard({ result, onConfirm, onDiscard, onEdit }: Props) {
  const canConfirm = result.intent !== "unknown";
  // "Editar" solo tiene sentido si hay un form para ese intent (no para
  // recordatorio suelto ni cuando no se entendió nada).
  const canEdit =
    Boolean(onEdit) &&
    (result.intent === "register_feeding" ||
      result.intent === "register_diaper" ||
      result.intent === "create_question");

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
          Detecté esto
        </p>
        <IntentBadge intent={result.intent} />
      </div>

      {result.transcript && (
        <p className="mt-2 text-xs italic text-[var(--ink-soft)] line-clamp-2">
          &ldquo;{result.transcript}&rdquo;
        </p>
      )}

      <div className="mt-4">
        <EventRows result={result} />
      </div>

      {result.warnings.length > 0 && (
        <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--danger-tint)] px-3 py-2">
          {result.warnings.map((warning) => (
            <p className="text-xs font-semibold text-[var(--danger)]" key={warning}>
              {warning}
            </p>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-[var(--ink-soft)]">
        Revisalo antes de guardar.
      </p>

      <div className="mt-4 flex gap-3">
        <button
          className="tap-target flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--primary)] px-4 py-3 text-sm font-bold text-[var(--primary-ink)]"
          disabled={!canConfirm}
          type="button"
          onClick={onConfirm}
        >
          <Check size={17} />
          Confirmar
        </button>
        <button
          className={[
            "tap-target flex items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold",
            canEdit ? "" : "opacity-50"
          ].join(" ")}
          disabled={!canEdit}
          type="button"
          onClick={canEdit ? onEdit : undefined}
        >
          <Pencil size={15} />
          Editar
        </button>
        <button
          aria-label="Descartar"
          className="tap-target flex items-center justify-center rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
          type="button"
          onClick={onDiscard}
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
