"use client";

import { Bell, Milk, Pencil } from "lucide-react";

import { deleteFeedingAction } from "@/app/actions";
import type { DayGroup } from "@/src/data/history";
import { formatArgentinaTime } from "@/src/domain/time";
import type { FeedingEvent, TodaySummary } from "@/src/domain/types";

import { DayAccordion } from "./day-accordion";
import { EventSheet } from "./event-sheet";
import { FeedingForm, type FeedingInitial } from "./forms/feeding-form";
import { feedingToInitial } from "./forms/initials";
import { useSectionSheet } from "./forms/use-section-sheet";
import { AddButton, EmptyState, SectionHeading, formatDayLabel } from "./section-ui";

/** Resumen de pechos/minutos para la card de la lista. */
function feedingDetail(feeding: FeedingEvent) {
  const parts = [
    feeding.leftBreastMinutes ? `Izq ${feeding.leftBreastMinutes} min` : null,
    feeding.rightBreastMinutes ? `Der ${feeding.rightBreastMinutes} min` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Registrada";
}

/** Card de una toma, tappable para editar. Se reusa en hoy y en el histórico. */
function FeedingCard({ feeding, onEdit }: { feeding: FeedingEvent; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-start gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)]">
        <Milk size={19} className="text-[var(--feed)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{formatArgentinaTime(feeding.startedAt)}</p>
        <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{feedingDetail(feeding)}</p>
      </div>
      <Pencil size={15} className="mt-1 shrink-0 text-[var(--ink-soft)]" />
    </button>
  );
}

export function FeedingScreen({
  summary,
  history
}: {
  summary: TodaySummary;
  history: DayGroup<FeedingEvent>[];
}) {
  const { sheet, openAdd, openEdit, close, remove } = useSectionSheet<FeedingInitial>(
    "tomas",
    deleteFeedingAction
  );
  const feedings = summary.feedings;

  return (
    <div className="flex flex-col gap-4 px-5 pb-28 pt-1">
      <SectionHeading title="Tomas" subtitle={`${summary.counts.feedings} hoy`} />

      {summary.nextReminder ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--feed-tint)] p-4">
          <Bell size={20} className="text-[var(--feed)]" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
              Próxima alarma
            </p>
            <p className="text-2xl font-bold text-[var(--feed)]">
              {formatArgentinaTime(summary.nextReminder.remindAt)}
            </p>
          </div>
        </div>
      ) : null}

      <AddButton label="Registrar toma" onClick={openAdd} />

      <div className="space-y-3">
        {feedings.length === 0 ? (
          <EmptyState>Sin tomas hoy</EmptyState>
        ) : (
          feedings.map((feeding) => (
            <FeedingCard
              key={feeding.id}
              feeding={feeding}
              onEdit={() => openEdit(feeding.id, feedingToInitial(feeding))}
            />
          ))
        )}
      </div>

      {history.length > 0 ? (
        <div className="mt-2 space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
            Días anteriores
          </h2>
          {history.map((day) => (
            <DayAccordion
              key={day.dayKey}
              label={formatDayLabel(day.dayKey)}
              summary={`${day.events.length} ${day.events.length === 1 ? "toma" : "tomas"}`}
            >
              {day.events.map((feeding) => (
                <FeedingCard
                  key={feeding.id}
                  feeding={feeding}
                  onEdit={() => openEdit(feeding.id, feedingToInitial(feeding))}
                />
              ))}
            </DayAccordion>
          ))}
        </div>
      ) : null}

      {sheet ? (
        <EventSheet
          title={sheet.editId ? "Editar toma" : "Toma"}
          onClose={close}
          onDelete={sheet.editId ? () => remove(sheet.editId as string) : undefined}
        >
          <FeedingForm
            nowLocal={summary.nowLocal}
            initial={sheet.initial}
            editId={sheet.editId}
            onDone={close}
          />
        </EventSheet>
      ) : null}
    </div>
  );
}
