import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getFamilyContext } from "@/src/data/context";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

import { createFamilyInviteAction } from "./actions";

type FamilyPageProps = {
  searchParams: Promise<{
    code?: string;
    email?: string;
    expires?: string;
    message?: string;
  }>;
};

function formatExpiration(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit"
  }).format(date);
}

function messageCopy(message?: string) {
  if (message === "save-failed") {
    return "No pude crear la invitación. Probá de nuevo.";
  }

  if (message === "invalid") {
    return "Ingresá un email válido para la invitación.";
  }

  return null;
}

function buildInviteUrl(code: string, host: string | null, proto: string | null) {
  const protocol = proto ?? "http";
  const baseHost = host ?? "localhost:3000";

  return `${protocol}://${baseHost}/invite/${encodeURIComponent(code)}`;
}

export default async function FamilyPage({ searchParams }: FamilyPageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const context = await getFamilyContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "missing-family") {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const headerList = await headers();
  const message = messageCopy(params.message);
  const expiresAt = formatExpiration(params.expires);
  const inviteUrl = params.code
    ? buildInviteUrl(
        params.code,
        headerList.get("x-forwarded-host") ?? headerList.get("host"),
        headerList.get("x-forwarded-proto")
      )
    : null;

  return (
    <main className="mobile-shell flex min-h-svh flex-col px-5 py-8">
      <section>
        <Link className="text-sm font-bold text-[var(--primary)]" href="/">
          Volver
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Familia
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          Invitar a la madre
        </h1>
        <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
          Ingresá su email y generá un link para que cree su cuenta o inicie
          sesión. Solo ese email va a poder unirse a {context.baby.name}.
        </p>
      </section>

      <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-sm font-bold text-[var(--ink-soft)]">
          Usuario actual
        </p>
        <p className="mt-1 truncate text-lg font-bold">
          {context.user.email ?? "usuario"}
        </p>
        <p className="mt-4 text-sm font-bold text-[var(--ink-soft)]">Bebé</p>
        <p className="mt-1 text-lg font-bold">{context.baby.name}</p>
      </section>

      {params.code ? (
        <section className="mt-4 rounded-[var(--radius-lg)] border border-[var(--primary)] bg-[var(--primary-tint)] p-5">
          <p className="text-sm font-bold text-[var(--ink-soft)]">
            Link de invitación
          </p>
          {params.email ? (
            <p className="mt-1 truncate text-sm font-bold text-[var(--foreground)]">
              {params.email}
            </p>
          ) : null}
          {inviteUrl ? (
            <p className="mt-3 select-all break-all rounded-[var(--radius-md)] bg-[var(--surface-strong)] px-4 py-4 text-sm font-bold leading-6">
              {inviteUrl}
            </p>
          ) : null}
          <p className="mt-4 text-sm font-bold text-[var(--ink-soft)]">
            Código manual
          </p>
          <p className="mt-3 select-all rounded-[var(--radius-md)] bg-[var(--surface-strong)] px-4 py-4 text-center text-3xl font-extrabold tracking-[0.22em]">
            {params.code}
          </p>
          <p className="mt-3 text-sm font-semibold leading-5 text-[var(--ink-soft)]">
            Compartile el link. Si algo falla, puede entrar a `/join` y pegar
            el código manualmente. {expiresAt ? `Vence el ${expiresAt}.` : null}
          </p>
        </section>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--danger-tint)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
          {message}
        </p>
      ) : null}

      <form action={createFamilyInviteAction} className="mt-auto pb-4 pt-8">
        <label className="mb-4 block">
          <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
            Email de la madre
          </span>
          <input
            className="field"
            inputMode="email"
            name="invitedEmail"
            placeholder="nombre@email.com"
            required
            type="email"
          />
        </label>
        <input name="role" type="hidden" value="parent" />
        <button
          className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
          type="submit"
        >
          Generar código
        </button>
      </form>
    </main>
  );
}
