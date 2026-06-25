import Link from "next/link";
import { redirect } from "next/navigation";

import { getFamilyContext } from "@/src/data/context";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

import { signInAction } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

function messageCopy(message?: string) {
  if (message === "missing") {
    return "Completá email y contraseña.";
  }

  if (message === "invalid") {
    return "No pude iniciar sesión con esos datos.";
  }

  if (message === "check-email") {
    return "Te envié un email para confirmar la cuenta. Después podés entrar.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const context = await getFamilyContext();

  if (context.status !== "unauthenticated") {
    redirect("/");
  }

  const params = await searchParams;
  const message = messageCopy(params.message);

  return (
    <main className="mobile-shell flex min-h-svh flex-col px-5 py-8">
      <section className="mt-auto pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Baby&apos;s Project
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">Entrar</h1>
        <form action={signInAction} className="mt-8 space-y-4">
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
              autoComplete="current-password"
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
            Entrar
          </button>
        </form>
        <Link
          className="mt-5 block text-center text-sm font-bold text-[var(--ink-soft)]"
          href="/reset"
        >
          Olvidé mi contraseña
        </Link>
        <Link
          className="mt-3 block text-center text-sm font-bold text-[var(--primary)]"
          href="/signup"
        >
          Crear cuenta
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
