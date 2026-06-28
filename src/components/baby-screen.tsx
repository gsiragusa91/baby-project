"use client";

import { Baby as BabyIcon, Cake, ImagePlus, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createBabyPhotoAction,
  deleteBabyPhotoAction,
  updateBabyAction
} from "@/app/actions";
import { preparePhotoFormData } from "@/src/lib/image";
import type { AlbumPhoto, Baby } from "@/src/domain/types";

import { EventSheet } from "./event-sheet";
import { PhotoField } from "./forms/photo-field";
import { SectionHeading } from "./section-ui";

/** Edad del bebé en semanas + días, calculada desde la fecha de nacimiento. */
function ageFromBirth(birthDate: string) {
  const birth = new Date(`${birthDate}T00:00:00-03:00`);
  const days = Math.max(0, Math.floor((Date.now() - birth.getTime()) / 86_400_000));
  const weeks = Math.floor(days / 7);
  return { weeks, days: days % 7 };
}

function formatBirthDate(birthDate: string) {
  return new Date(`${birthDate}T00:00:00-03:00`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatTaken(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

/** Agrupa las fotos (ya ordenadas desc) por semana de vida, preservando el orden. */
function groupByWeek(photos: AlbumPhoto[]) {
  const groups = new Map<number, AlbumPhoto[]>();
  for (const photo of photos) {
    const list = groups.get(photo.weekIndex) ?? [];
    list.push(photo);
    groups.set(photo.weekIndex, list);
  }
  return [...groups.entries()];
}

type Sheet =
  | null
  | { type: "edit" }
  | { type: "add" }
  | { type: "view"; photo: AlbumPhoto };

export function BabyScreen({ baby, album }: { baby: Baby; album: AlbumPhoto[] }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const age = ageFromBirth(baby.birthDate);

  async function deletePhoto(id: string) {
    if (!window.confirm("¿Eliminar esta foto del álbum?")) {
      return;
    }
    const formData = new FormData();
    formData.append("id", id);
    await deleteBabyPhotoAction(formData);
    setSheet(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-28 pt-1">
      <SectionHeading title="Tu bebé" />

      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-strong)]">
            <BabyIcon size={28} className="text-[var(--sleep)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl font-bold">{baby.name}</p>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink-soft)]">
              <Cake size={14} />
              {formatBirthDate(baby.birthDate)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Editar datos del bebé"
            onClick={() => setSheet({ type: "edit" })}
            className="tap-target rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5"
          >
            <Pencil size={16} className="text-[var(--ink-soft)]" />
          </button>
        </div>
        <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--sleep-tint)] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
            Edad
          </p>
          <p className="mt-1 text-xl font-bold text-[var(--sleep)]">
            {age.weeks > 0 ? `${age.weeks} sem` : ""}
            {age.weeks > 0 && age.days > 0 ? " · " : ""}
            {age.days > 0 || age.weeks === 0 ? `${age.days} d` : ""}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSheet({ type: "add" })}
        className="tap-target flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
      >
        <Plus size={20} />
        Agregar foto
      </button>

      {album.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--line)] px-4 py-8 text-center">
          <ImagePlus size={28} className="text-[var(--ink-soft)]" />
          <p className="text-sm font-semibold text-[var(--ink-soft)]">
            Todavía no hay fotos. Empezá el álbum.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupByWeek(album).map(([weekIndex, photos]) => (
            <div key={weekIndex} className="space-y-3">
              <h2 className="text-sm font-bold text-[var(--ink-soft)]">
                Semana {weekIndex + 1}
              </h2>
              <div className="space-y-4">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSheet({ type: "view", photo })}
                    className="block w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] text-left transition-transform active:scale-[0.99]"
                  >
                    <div className="px-4 pb-2 pt-3">
                      {photo.note ? (
                        <p className="text-base font-bold leading-snug">{photo.note}</p>
                      ) : null}
                      <p
                        className={`text-xs font-semibold text-[var(--ink-soft)] ${
                          photo.note ? "mt-0.5" : ""
                        }`}
                      >
                        {formatTaken(photo.takenAt)}
                      </p>
                    </div>
                    {photo.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.signedUrl}
                        alt={photo.note ?? "Foto del bebé"}
                        className="max-h-[440px] w-full object-cover"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {sheet?.type === "edit" ? (
        <EventSheet title="Editar bebé" onClose={() => setSheet(null)}>
          <form
            action={async (formData) => {
              await updateBabyAction(formData);
              setSheet(null);
              router.refresh();
            }}
            className="space-y-4"
          >
            <input
              className="field"
              name="name"
              type="text"
              defaultValue={baby.name}
              placeholder="Nombre"
              required
            />
            <input
              className="field"
              name="birthDate"
              type="date"
              defaultValue={baby.birthDate}
              required
            />
            <button
              className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
              type="submit"
            >
              Guardar cambios
            </button>
          </form>
        </EventSheet>
      ) : null}

      {sheet?.type === "add" ? (
        <EventSheet title="Agregar foto" onClose={() => setSheet(null)}>
          <form
            action={async (formData) => {
              await preparePhotoFormData(formData);
              await createBabyPhotoAction(formData);
              setSheet(null);
              router.refresh();
            }}
            className="space-y-4"
          >
            <PhotoField />
            <input className="field" name="takenAt" type="datetime-local" />
            <textarea
              className="field min-h-20 resize-none"
              name="note"
              placeholder="Nota (opcional)"
            />
            <button
              className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
              type="submit"
            >
              Guardar foto
            </button>
          </form>
        </EventSheet>
      ) : null}

      {sheet?.type === "view" ? (
        <EventSheet
          title={formatTaken(sheet.photo.takenAt)}
          onClose={() => setSheet(null)}
          onDelete={() => deletePhoto(sheet.photo.id)}
        >
          {sheet.photo.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sheet.photo.signedUrl}
              alt={sheet.photo.note ?? "Foto del bebé"}
              className="w-full rounded-[var(--radius-md)] object-contain"
            />
          ) : null}
          {sheet.photo.note ? (
            <p className="mt-3 text-sm text-[var(--ink-soft)]">{sheet.photo.note}</p>
          ) : null}
        </EventSheet>
      ) : null}
    </div>
  );
}
