import { DiaperScreen } from "@/src/components/diaper-screen";
import { getDiaperHistory } from "@/src/data/history";
import { resolveReadyContext } from "@/src/data/page-context";
import { getTodaySummary } from "@/src/data/today";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

export default async function PanalesPage() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const context = await resolveReadyContext();
  const [summary, history] = await Promise.all([
    getTodaySummary(context),
    getDiaperHistory(context)
  ]);

  return <DiaperScreen summary={summary} history={history} />;
}
