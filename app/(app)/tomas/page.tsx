import { FeedingScreen } from "@/src/components/feeding-screen";
import { getFeedingHistory } from "@/src/data/history";
import { resolveReadyContext } from "@/src/data/page-context";
import { getTodaySummary } from "@/src/data/today";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

export default async function TomasPage() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const context = await resolveReadyContext();
  const [summary, history] = await Promise.all([
    getTodaySummary(context),
    getFeedingHistory(context)
  ]);

  return <FeedingScreen summary={summary} history={history} />;
}
