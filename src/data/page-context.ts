import { redirect } from "next/navigation";

import { getFamilyContext, type ReadyFamilyContext } from "./context";

/**
 * Resuelve el contexto familiar para una página del route group (app) y
 * redirige si falta sesión o familia. Asume Supabase configurado (el layout
 * muestra SetupRequired si no lo está). Devuelve siempre contexto "ready".
 */
export async function resolveReadyContext(): Promise<ReadyFamilyContext> {
  const context = await getFamilyContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "missing-family") {
    redirect("/onboarding");
  }

  return context;
}
