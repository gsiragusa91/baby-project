import { FeedingScreen } from "@/src/components/feeding-screen";
import { resolveReadyContext } from "@/src/data/page-context";
import { getTodaySummary } from "@/src/data/today";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

export default async function TomasPage() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const context = await resolveReadyContext();
  const summary = await getTodaySummary(context);

  return <FeedingScreen summary={summary} />;
}
