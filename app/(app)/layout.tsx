import { redirect } from "next/navigation";

import { AppShell } from "@/src/components/app-shell";
import { SetupRequired } from "@/src/components/setup-required";
import { getFamilyContext } from "@/src/data/context";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

/**
 * Layout compartido de todas las tabs. Resuelve el contexto para el header y
 * monta el chrome global (header + voz + tab bar). Cada page debajo vuelve a
 * resolver su propio slice de datos.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
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

  return (
    <AppShell babyName={context.baby.name} email={context.user.email ?? "usuario"}>
      {children}
    </AppShell>
  );
}
