"use client";

import { Check, CircleHelp, Droplets, Milk, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

import { markQuestionAnsweredAction } from "@/app/actions";
import { DIAPER_LABELS } from "@/src/domain/labels";
import { formatArgentinaTime } from "@/src/domain/time";
import type { TodaySummary } from "@/src/domain/types";
import { stashPendingForm } from "@/src/lib/pending-form";

import { diaperToInitial, feedingToInitial, questionToInitial } from "./forms/initials";
import { PushSetup } from "./push-setup";

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

export function InicioScreen({ summary }: { summary: TodaySummary }) {
  const router = useRouter();

  // Tap en un item del timeline: deja la edición en el handoff y navega a la
  // sección, donde el form se abre pre-cargado.
  function editTimelineItem(type: string, id: string) {
    if (type === "diaper") {
      const event = summary.diapers.find((d) => d.id === id);
      if (event) {
        stashPendingForm({ section: "panales", editId: id, initial: diaperToInitial(event) });
        router.push("/panales");
      }
    } else if (type === "feeding") {
      const event = summary.feedings.find((f) => f.id === id);
      if (event) {
        stashPendingForm({ section: "tomas", editId: id, initial: feedingToInitial(event) });
        router.push("/tomas");
      }
    } else if (type === "question") {
      const event = summary.pendingQuestions.find((q) => q.id === id);
      if (event) {
        stashPendingForm({ section: "dudas", editId: id, initial: questionToInitial(event) });
        router.push("/dudas");
      }
    }
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-28 pt-1">
      <PushSetup />

      <section className="grid grid-cols-3 gap-3">
        <Metric label="Pañales" value={summary.counts.diapers} />
        <Metric label="Tomas" value={summary.counts.feedings} />
        <Metric label="Dudas" value={summary.counts.pendingQuestions} />
      </section>

      <section className="space-y-3">
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

      <section>
        <h2 className="text-xl font-bold">Timeline</h2>
        <div className="mt-3 space-y-3">
          {summary.timeline.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm font-semibold text-[var(--ink-soft)]">
              Sin registros todavía
            </p>
          ) : (
            summary.timeline.map((item) => (
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3 text-left transition-transform active:scale-[0.99]"
                key={`${item.type}-${item.id}`}
                onClick={() => editTimelineItem(item.type, item.id)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)]">
                  {item.type === "diaper" ? <Droplets size={19} className="text-[var(--diaper)]" /> : null}
                  {item.type === "feeding" ? <Milk size={19} className="text-[var(--feed)]" /> : null}
                  {item.type === "question" ? <CircleHelp size={19} className="text-[var(--sleep)]" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-soft)]">{item.detail}</p>
                </div>
                <Pencil size={15} className="mt-1 shrink-0 text-[var(--ink-soft)]" />
              </button>
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
    </div>
  );
}
