import { redirect } from "next/navigation";

import { TodayClient } from "@/src/components/today-client";
import { getFamilyContext } from "@/src/data/context";
import { getTodaySummary } from "@/src/data/today";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

function SetupRequired() {
  return (
    <main className="mobile-shell flex min-h-svh flex-col px-5 py-8">
      <div className="mt-10 rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Setup
        </p>
        <h1 className="mt-3 text-3xl font-bold">Falta conectar Supabase</h1>
        <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
          Copiá `.env.example` a `.env.local`, completá las credenciales y corré el
          schema SQL en Supabase.
        </p>
      </div>
    </main>
  );
}

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  const context = await getFamilyContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "missing-family") {
    redirect("/onboarding");
  }

  const summary = await getTodaySummary(context);

  return (
    <TodayClient
      summary={summary}
      userEmail={context.user.email ?? "usuario"}
    />
  );
}
