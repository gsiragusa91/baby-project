import Link from "next/link";
import { redirect } from "next/navigation";

import { getFamilyContext } from "@/src/data/context";
import { joinFamilyInputSchema } from "@/src/domain/schemas";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

import {
  acceptInviteAction,
  inviteSignInAction,
  inviteSignUpAction
} from "./actions";

type InvitePageProps = {
  params: Promise<{
    code: string;
  }>;
  searchParams: Promise<{
    message?: string;
  }>;
};

type InvitePreview = {
  invited_email: string | null;
  invite_expires_at: string | null;
  is_available: boolean;
};

function messageCopy(message?: string) {
  if (message === "auth-invalid") {
    return "Revisá el email y la contraseña.";
  }

  if (message === "check-email") {
    return "Te envié un email para confirmar la cuenta. Después volvé a abrir este link.";
  }

  if (message === "email-mismatch") {
    return "Esta invitación pertenece a otro email. Cerrá sesión o pedí una nueva invitación.";
  }

  if (message === "invalid") {
    return "La invitación no existe, ya fue usada o venció.";
  }

  return null;
}

function formatExpiration(value?: string | null) {
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

async function getInvitePreview(code: string) {
  const parsed = joinFamilyInputSchema.safeParse({ code });

  if (!parsed.success) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_family_invite_preview", {
    p_code: parsed.data.code
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as InvitePreview[] | null)?.[0] ?? null;
}

function InvalidInvite({ message }: { message?: string }) {
  return (
    <main className="mobile-shell flex min-h-svh flex-col px-5 py-8">
      <section className="mt-auto pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Invitación
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          No pude usar este link
        </h1>
        <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
          {message ?? "La invitación no existe, ya fue usada o venció."}
        </p>
        <Link
          className="tap-target mt-8 flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
          href="/join"
        >
          Probar con código manual
        </Link>
      </section>
    </main>
  );
}

function AuthForms({
  code,
  invitedEmail,
  message
}: {
  code: string;
  invitedEmail: string;
  message?: string;
}) {
  return (
    <main className="mobile-shell flex min-h-svh flex-col px-5 py-8">
      <section className="mt-auto pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Invitación
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          Unirte a la familia
        </h1>
        <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
          Usá este email y una contraseña. Si ya tenés cuenta, entrá abajo con
          los mismos datos.
        </p>

        {message ? (
          <p className="mt-5 rounded-[var(--radius-md)] bg-[var(--danger-tint)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
            {message}
          </p>
        ) : null}

        <form action={inviteSignUpAction} className="mt-8 space-y-4">
          <input name="code" type="hidden" value={code} />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Email
            </span>
            <input
              className="field"
              name="email"
              readOnly
              type="email"
              value={invitedEmail}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Contraseña
            </span>
            <input
              autoComplete="new-password"
              className="field"
              minLength={6}
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
            type="submit"
          >
            Crear cuenta y unirme
          </button>
        </form>

        <form action={inviteSignInAction} className="mt-5 space-y-4">
          <input name="code" type="hidden" value={code} />
          <input name="email" type="hidden" value={invitedEmail} />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">
              Ya tengo cuenta
            </span>
            <input
              autoComplete="current-password"
              className="field"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="tap-target w-full rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-base font-bold"
            type="submit"
          >
            Entrar y unirme
          </button>
        </form>
      </section>
    </main>
  );
}

export default async function InvitePage({
  params,
  searchParams
}: InvitePageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const { code } = await params;
  const preview = await getInvitePreview(code);
  const query = await searchParams;
  const message = messageCopy(query.message);

  if (!preview || !preview.is_available || !preview.invited_email) {
    return <InvalidInvite message={message ?? undefined} />;
  }

  const context = await getFamilyContext();
  const expiresAt = formatExpiration(preview.invite_expires_at);

  if (context.status === "ready") {
    const currentEmail = context.user.email?.toLowerCase() ?? "";

    if (currentEmail !== preview.invited_email.toLowerCase()) {
      return <InvalidInvite message={messageCopy("email-mismatch") ?? undefined} />;
    }

    redirect("/");
  }

  if (context.status === "missing-family") {
    const currentEmail = context.user.email?.toLowerCase() ?? "";

    if (currentEmail !== preview.invited_email.toLowerCase()) {
      return <InvalidInvite message={messageCopy("email-mismatch") ?? undefined} />;
    }

    return (
      <main className="mobile-shell flex min-h-svh flex-col px-5 py-8">
        <section className="mt-auto pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
            Invitación
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight">
            Ya podés unirte
          </h1>
          <p className="mt-3 text-base leading-6 text-[var(--ink-soft)]">
            Estás entrando con {preview.invited_email}. Tocá el botón y quedás
            asociada a la familia. {expiresAt ? `Vence el ${expiresAt}.` : null}
          </p>
          {message ? (
            <p className="mt-5 rounded-[var(--radius-md)] bg-[var(--danger-tint)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
              {message}
            </p>
          ) : null}
          <form action={acceptInviteAction} className="mt-8">
            <input name="code" type="hidden" value={code} />
            <button
              className="tap-target w-full rounded-[var(--radius-lg)] bg-[var(--primary)] px-5 py-4 text-base font-bold text-[var(--primary-ink)]"
              type="submit"
            >
              Unirme a la familia
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <AuthForms
      code={code}
      invitedEmail={preview.invited_email}
      message={message ?? undefined}
    />
  );
}
