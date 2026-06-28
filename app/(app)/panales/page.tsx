import { DiaperScreen } from "@/src/components/diaper-screen";
import { resolveReadyContext } from "@/src/data/page-context";
import { getTodaySummary } from "@/src/data/today";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

export default async function PanalesPage() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const context = await resolveReadyContext();
  const summary = await getTodaySummary(context);

  return <DiaperScreen summary={summary} />;
}
