import { signedUrlsFor } from "@/src/lib/supabase/storage";
import type { AlbumPhoto, BabyPhoto } from "@/src/domain/types";

import type { ReadyFamilyContext } from "./context";

type BabyPhotoRow = {
  id: string;
  baby_id: string;
  family_id: string;
  created_by_user_id: string;
  created_at: string;
  taken_at: string;
  photo_url: string;
  note: string | null;
  source: BabyPhoto["source"];
};

/** Semana de vida (0-indexada) del bebé en una fecha dada. */
function weekIndexFor(birthDate: string, takenAt: string): number {
  const birth = new Date(`${birthDate}T00:00:00-03:00`).getTime();
  const taken = new Date(takenAt).getTime();
  const days = Math.floor((taken - birth) / 86_400_000);
  return Math.max(0, Math.floor(days / 7));
}

/**
 * Fotos del álbum del bebé, más recientes primero, con signed URL y la semana
 * de vida en que se sacó cada una (para agrupar en la UI).
 */
export async function getBabyAlbum(context: ReadyFamilyContext): Promise<AlbumPhoto[]> {
  const { supabase, baby, familyId } = context;

  const { data, error } = await supabase
    .from("baby_photos")
    .select("*")
    .eq("baby_id", baby.id)
    .eq("family_id", familyId)
    .order("taken_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as BabyPhotoRow[];
  const signedUrls = await signedUrlsFor(context, rows.map((row) => row.photo_url));

  return rows.map((row) => ({
    id: row.id,
    takenAt: row.taken_at,
    note: row.note,
    signedUrl: signedUrls.get(row.photo_url) ?? null,
    weekIndex: weekIndexFor(baby.birthDate, row.taken_at)
  }));
}
