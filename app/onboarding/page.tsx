import { redirect } from "next/navigation";
import Link from "next/link";

import { getFamilyContext } from "@/src/data/context";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

import { createInitialFamilyAction } from "./actions";

type OnboardingPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function messageCopy(message?: string) {
  if (message === "invalid") {
    return "Revisá nombre del bebé y fecha de nacimiento.";
  }

  if (message === "save-failed") {
    return "No pude crear la familia. Si acabás de actualizar la base, corré la nueva migración.";
  }

  return null;
}

export default async function OnboardingPage({
  searchParams
}: OnboardingPageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const context = await getFamilyContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "ready") {
    redirect("/");
  }

  const params = await searchParams;
  const message = messageCopy(params.message);
  const today = todayInputValue();

  return (
    <main className="mobile-shell flex min-h-svh flex-col px-5 py-8">
      <section className="mt-auto pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Primer setup
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          Armemos la familia
        </h1>
        <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
          Esto crea la familia, te asigna como miembro y registra el bebé
          inicial para empezar a cargar eventos.
        </p>

        <form action={createInitialFamilyAction} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Nombre de familia
            </span>
            <input
              className="field"
              name="familyName"
              placeholder="Ej. Familia Siragusa"
              type="text"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Nombre del bebé
            </span>
            <input
              className="field"
              name="babyName"
              placeholder="Ej. Olivia"
              type="text"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Fecha de nacimiento
            </span>
            <input
              className="field"
              max={today}
              name="babyBirthDate"
              type="date"
              required
            />
          </label>
          {message ? (
            <p className="rounded-[var(--radius-md)] bg-[var(--danger-tint)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
              {message}
            </p>
          ) : null}
          <button
            className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
            type="submit"
          >
            Empezar
          </button>
        </form>
        <Link
          className="mt-5 block text-center text-sm font-bold text-[var(--primary)]"
          href="/join"
        >
          Tengo un código de invitación
        </Link>
      </section>
    </main>
  );
}
