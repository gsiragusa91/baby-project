import Link from "next/link";
import { redirect } from "next/navigation";

import { getFamilyContext } from "@/src/data/context";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

import { joinFamilyAction } from "./actions";

type JoinPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

function messageCopy(message?: string) {
  if (message === "invalid") {
    return "El código no existe, ya fue usado, venció o pertenece a otro email.";
  }

  return null;
}

function AuthRequired() {
  return (
    <main className="mobile-shell flex min-h-svh flex-col px-5 py-8">
      <section className="mt-auto pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Invitación
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          Primero entrá con tu cuenta
        </h1>
        <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
          Cada adulto tiene su propio usuario. Después de entrar, pegás el
          código y quedás asociada a la misma familia.
        </p>
        <div className="mt-8 grid gap-3">
          <Link
            className="tap-target flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
            href="/signup"
          >
            Crear cuenta
          </Link>
          <Link
            className="tap-target flex items-center justify-center rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-base font-bold"
            href="/login"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const context = await getFamilyContext();

  if (context.status === "unauthenticated") {
    return <AuthRequired />;
  }

  if (context.status === "ready") {
    redirect("/");
  }

  const params = await searchParams;
  const message = messageCopy(params.message);

  return (
    <main className="mobile-shell flex min-h-svh flex-col px-5 py-8">
      <section className="mt-auto pb-8">
        <Link className="text-sm font-bold text-[var(--primary)]" href="/">
          Volver
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Invitación
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          Unirme a una familia
        </h1>
        <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
          Pegá el código que te compartieron para ver el mismo bebé y cargar
          eventos desde tu usuario.
        </p>

        <form action={joinFamilyAction} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Código
            </span>
            <input
              autoCapitalize="characters"
              className="field text-center text-2xl font-extrabold tracking-[0.18em]"
              inputMode="text"
              maxLength={24}
              name="code"
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
            Unirme
          </button>
        </form>
      </section>
    </main>
  );
}
