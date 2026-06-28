import { BabyScreen } from "@/src/components/baby-screen";
import { getBabyAlbum } from "@/src/data/album";
import { resolveReadyContext } from "@/src/data/page-context";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

export default async function BebePage() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const context = await resolveReadyContext();
  const album = await getBabyAlbum(context);

  return <BabyScreen baby={context.baby} album={album} />;
}
