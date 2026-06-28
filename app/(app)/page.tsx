import { InicioScreen } from "@/src/components/inicio-screen";
import { resolveReadyContext } from "@/src/data/page-context";
import { getTodaySummary } from "@/src/data/today";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

export default async function InicioPage() {
  if (!isSupabaseConfigured()) {
    return null; // el layout muestra SetupRequired
  }

  const context = await resolveReadyContext();
  const summary = await getTodaySummary(context);

  return <InicioScreen summary={summary} />;
}
