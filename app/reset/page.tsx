import Link from "next/link";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/src/lib/supabase/config";

import { requestPasswordResetAction } from "./actions";

type ResetPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

function messageCopy(message?: string) {
  if (message === "invalid") {
    return { tone: "error" as const, text: "Ingresá un email válido." };
  }

  if (message === "expired") {
    return {
      tone: "error" as const,
      text: "El link venció o ya se usó. Pedí uno nuevo."
    };
  }

  if (message === "sent") {
    return {
      tone: "ok" as const,
      text: "Si hay una cuenta con ese email, te mandamos un link para crear una contraseña nueva. Revisá tu correo."
    };
  }

  return null;
}

export default async function ResetPage({ searchParams }: ResetPageProps) {
  if (!isSupabaseConfigured()) {
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
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          Recuperar contraseña
        </h1>
        <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
          Poné tu email y te mandamos un link para crear una contraseña nueva.
        </p>

        {message ? (
          <p
            className={
              message.tone === "ok"
                ? "mt-5 rounded-[var(--radius-md)] bg-[var(--primary-tint)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                : "mt-5 rounded-[var(--radius-md)] bg-[var(--danger-tint)] px-4 py-3 text-sm font-semibold text-[var(--danger)]"
            }
          >
            {message.text}
          </p>
        ) : null}

        <form action={requestPasswordResetAction} className="mt-8 space-y-4">
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
          <button
            className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
            type="submit"
          >
            Enviar link
          </button>
        </form>

        <Link
          className="mt-5 block text-center text-sm font-bold text-[var(--primary)]"
          href="/login"
        >
          Volver a entrar
        </Link>
      </section>
    </main>
  );
}
