"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authCredentialsSchema, joinFamilyInputSchema } from "@/src/domain/schemas";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function invitePath(code: string, message?: string) {
  const suffix = message ? `?message=${encodeURIComponent(message)}` : "";

  return `/invite/${encodeURIComponent(code)}${suffix}`;
}

async function getOrigin() {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";

  return `${proto}://${host}`;
}

async function acceptInviteOrRedirect(code: string) {
  const parsed = joinFamilyInputSchema.safeParse({ code });

  if (!parsed.success) {
    redirect(invitePath(code, "invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("join_family_with_invite", {
    p_code: parsed.data.code
  });

  if (error) {
    if (error.message.includes("user_already_has_family")) {
      redirect("/");
    }

    if (error.message.includes("email_mismatch")) {
      redirect(invitePath(code, "email-mismatch"));
    }

    redirect(invitePath(code, "invalid"));
  }

  redirect("/");
}

export async function acceptInviteAction(formData: FormData) {
  const code = String(formData.get("code") ?? "");

  await acceptInviteOrRedirect(code);
}

export async function inviteSignInAction(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const parsed = authCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect(invitePath(code, "auth-invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    redirect(invitePath(code, "auth-invalid"));
  }

  await acceptInviteOrRedirect(code);
}

export async function inviteSignUpAction(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const parsed = authCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect(invitePath(code, "auth-invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/invite/${encodeURIComponent(code)}`
    }
  });

  if (error) {
    redirect(invitePath(code, "auth-invalid"));
  }

  if (!data.session) {
    redirect(invitePath(code, "check-email"));
  }

  await acceptInviteOrRedirect(code);
}
