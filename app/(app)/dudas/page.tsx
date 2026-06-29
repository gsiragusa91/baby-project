import { QuestionScreen } from "@/src/components/question-screen";
import { getAnsweredQuestions } from "@/src/data/history";
import { resolveReadyContext } from "@/src/data/page-context";
import { getTodaySummary } from "@/src/data/today";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

export default async function DudasPage() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const context = await resolveReadyContext();
  const [summary, answered] = await Promise.all([
    getTodaySummary(context),
    getAnsweredQuestions(context)
  ]);

  return <QuestionScreen summary={summary} answered={answered} />;
}
