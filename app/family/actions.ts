"use server";

import { redirect } from "next/navigation";

import { getFamilyContext } from "@/src/data/context";
import { familyInviteInputSchema } from "@/src/domain/schemas";

export async function createFamilyInviteAction(formData: FormData) {
  const context = await getFamilyContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "missing-family") {
    redirect("/onboarding");
  }

  const parsed = familyInviteInputSchema.safeParse({
    invitedEmail: formData.get("invitedEmail"),
    role: formData.get("role") ?? "parent"
  });

  if (!parsed.success) {
    redirect("/family?message=invalid");
  }

  const { data, error } = await context.supabase.rpc("create_family_invite", {
    p_family_id: context.familyId,
    p_invited_email: parsed.data.invitedEmail,
    p_role: parsed.data.role
  });

  if (error) {
    redirect("/family?message=save-failed");
  }

  const invite = (
    data as { invite_code: string; invite_expires_at: string }[] | null
  )?.[0];

  if (!invite) {
    redirect("/family?message=save-failed");
  }

  redirect(
    `/family?code=${encodeURIComponent(invite.invite_code)}&email=${encodeURIComponent(parsed.data.invitedEmail)}&expires=${encodeURIComponent(invite.invite_expires_at)}`
  );
}
