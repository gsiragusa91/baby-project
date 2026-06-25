import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

import { updatePasswordAction } from "./actions";

type UpdatePageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

function messageCopy(message?: string) {
  if (message === "invalid") {
    return "Las contraseñas no coinciden o son muy cortas (mínimo 6).";
  }

  if (message === "failed") {
    return "No pude actualizar la contraseña. Probá de nuevo.";
  }

  return null;
}

export default async function UpdatePasswordPage({
  searchParams
}: UpdatePageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  // Si no hay sesión de recovery, el link venció o se abrió en otro navegador.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/reset?message=expired");
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
          Nueva contraseña
        </h1>
        <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
          Elegí una contraseña nueva para {user.email}.
        </p>

        {message ? (
          <p className="mt-5 rounded-[var(--radius-md)] bg-[var(--danger-tint)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
            {message}
          </p>
        ) : null}

        <form action={updatePasswordAction} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Contraseña nueva
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
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Repetir contraseña
            </span>
            <input
              className="field"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <button
            className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
            type="submit"
          >
            Guardar contraseña
          </button>
        </form>
      </section>
    </main>
  );
}
