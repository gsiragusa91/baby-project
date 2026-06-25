import Link from "next/link";
import { redirect } from "next/navigation";

import { getFamilyContext } from "@/src/data/context";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

import { signUpAction } from "./actions";

type SignupPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

function messageCopy(message?: string) {
  if (message === "invalid") {
    return "Revisá el email y usá una contraseña de al menos 6 caracteres.";
  }

  return null;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const context = await getFamilyContext();

  if (context.status === "ready") {
    redirect("/");
  }

  if (context.status === "missing-family") {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const message = messageCopy(params.message);

  return (
    <main className="mobile-shell flex min-h-svh flex-col px-5 py-8">
      <section className="mt-auto pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Baby&apos;s Project
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          Crear cuenta
        </h1>
        <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
          Primero creamos tu usuario. En el paso siguiente armamos la familia y
          el bebé inicial.
        </p>

        <form action={signUpAction} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Email
            </span>
            <input
              className="field"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Contraseña
            </span>
            <input
              className="field"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
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
            Crear cuenta
          </button>
        </form>

        <Link
          className="mt-5 block text-center text-sm font-bold text-[var(--primary)]"
          href="/login"
        >
          Ya tengo cuenta
        </Link>
        <Link
          className="mt-3 block text-center text-sm font-bold text-[var(--ink-soft)]"
          href="/join"
        >
          Tengo un código de invitación
        </Link>
      </section>
    </main>
  );
}
