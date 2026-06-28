"use client";

import { Check } from "lucide-react";

import { deleteQuestionAction, markQuestionAnsweredAction } from "@/app/actions";
import { PROFESSIONAL_LABELS } from "@/src/domain/labels";
import type { TodaySummary } from "@/src/domain/types";

import { EventSheet } from "./event-sheet";
import { QuestionForm, type QuestionInitial } from "./forms/question-form";
import { questionToInitial } from "./forms/initials";
import { useSectionSheet } from "./forms/use-section-sheet";
import { AddButton, EmptyState, SectionHeading } from "./section-ui";

export function QuestionScreen({ summary }: { summary: TodaySummary }) {
  const { sheet, openAdd, openEdit, close, remove } = useSectionSheet<QuestionInitial>(
    "dudas",
    deleteQuestionAction
  );
  const questions = summary.pendingQuestions;

  return (
    <div className="flex flex-col gap-4 px-5 pb-28 pt-1">
      <SectionHeading title="Dudas" subtitle={`${questions.length} pendientes`} />
      <AddButton label="Anotar duda" onClick={openAdd} />

      <div className="space-y-3">
        {questions.length === 0 ? (
          <EmptyState>Sin dudas pendientes</EmptyState>
        ) : (
          questions.map((question) => (
            <div
              key={question.id}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-3"
            >
              {/* Texto tappable: abre el form de edición. */}
              <button
                type="button"
                onClick={() => openEdit(question.id, questionToInitial(question))}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-semibold leading-5">{question.text}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--ink-soft)]">
                  {PROFESSIONAL_LABELS[question.professional]}
                </p>
                {question.photoSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={question.photoSignedUrl}
                    alt="Foto de la duda"
                    className="mt-2 h-20 w-20 rounded-[var(--radius-md)] object-cover"
                  />
                ) : null}
              </button>
              {/* Marcar respondida: form aparte para no anidar botones. */}
              <form action={markQuestionAnsweredAction}>
                <input name="questionId" type="hidden" value={question.id} />
                <button
                  aria-label="Marcar respondida"
                  className="tap-target rounded-full bg-[var(--diaper-tint)] p-3 text-[var(--diaper)]"
                  type="submit"
                >
                  <Check size={18} />
                </button>
              </form>
            </div>
          ))
        )}
      </div>

      {sheet ? (
        <EventSheet
          title={sheet.editId ? "Editar duda" : "Duda"}
          onClose={close}
          onDelete={sheet.editId ? () => remove(sheet.editId as string) : undefined}
        >
          <QuestionForm initial={sheet.initial} editId={sheet.editId} onDone={close} />
        </EventSheet>
      ) : null}
    </div>
  );
}
