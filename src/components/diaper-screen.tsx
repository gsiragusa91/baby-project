"use client";

import { Droplets, Pencil, ShieldAlert } from "lucide-react";

import { deleteDiaperAction } from "@/app/actions";
import type { DayGroup } from "@/src/data/history";
import { DIAPER_LABELS } from "@/src/domain/labels";
import { formatArgentinaTime } from "@/src/domain/time";
import type { DiaperEvent, TodaySummary } from "@/src/domain/types";

import { DayAccordion } from "./day-accordion";
import { EventSheet } from "./event-sheet";
import { DiaperForm, type DiaperInitial } from "./forms/diaper-form";
import { diaperToInitial } from "./forms/initials";
import { useSectionSheet } from "./forms/use-section-sheet";
import { AddButton, EmptyState, SectionHeading, formatDayLabel } from "./section-ui";

/** Card de un pañal, tappable para editar. Se reusa en hoy y en el histórico. */
function DiaperCard({ diaper, onEdit }: { diaper: DiaperEvent; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-start gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)]">
        <Droplets size={19} className="text-[var(--diaper)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{DIAPER_LABELS[diaper.diaperType]}</p>
        <p className="mt-0.5 text-xs font-semibold text-[var(--ink-soft)]">
          {formatArgentinaTime(diaper.eventTime)}
        </p>
        {diaper.comment ? (
          <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-soft)]">{diaper.comment}</p>
        ) : null}
        {diaper.photoSignedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={diaper.photoSignedUrl}
            alt="Foto del pañal"
            className="mt-2 h-20 w-20 rounded-[var(--radius-md)] object-cover"
          />
        ) : null}
      </div>
      {diaper.abnormalFlag ? (
        <ShieldAlert size={15} className="mt-1 shrink-0 text-[var(--danger)]" />
      ) : (
        <Pencil size={15} className="mt-1 shrink-0 text-[var(--ink-soft)]" />
      )}
    </button>
  );
}

export function DiaperScreen({
  summary,
  history
}: {
  summary: TodaySummary;
  history: DayGroup<DiaperEvent>[];
}) {
  const { sheet, openAdd, openEdit, close, remove } = useSectionSheet<DiaperInitial>(
    "panales",
    deleteDiaperAction
  );
  const diapers = summary.diapers;

  return (
    <div className="flex flex-col gap-4 px-5 pb-28 pt-1">
      <SectionHeading title="Pañales" subtitle={`${summary.counts.diapers} hoy`} />
      <AddButton label="Registrar pañal" onClick={openAdd} />

      <div className="space-y-3">
        {diapers.length === 0 ? (
          <EmptyState>Sin pañales hoy</EmptyState>
        ) : (
          diapers.map((diaper) => (
            <DiaperCard
              key={diaper.id}
              diaper={diaper}
              onEdit={() => openEdit(diaper.id, diaperToInitial(diaper))}
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
              summary={`${day.events.length} ${day.events.length === 1 ? "pañal" : "pañales"}`}
            >
              {day.events.map((diaper) => (
                <DiaperCard
                  key={diaper.id}
                  diaper={diaper}
                  onEdit={() => openEdit(diaper.id, diaperToInitial(diaper))}
                />
              ))}
            </DayAccordion>
          ))}
        </div>
      ) : null}

      {sheet ? (
        <EventSheet
          title={sheet.editId ? "Editar pañal" : "Pañal"}
          onClose={close}
          onDelete={sheet.editId ? () => remove(sheet.editId as string) : undefined}
        >
          <DiaperForm
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
