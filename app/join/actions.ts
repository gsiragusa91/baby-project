"use server";

import { redirect } from "next/navigation";

import { joinFamilyInputSchema } from "@/src/domain/schemas";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function joinFamilyAction(formData: FormData) {
  const parsed = joinFamilyInputSchema.safeParse({
    code: formData.get("code")
  });

  if (!parsed.success) {
    redirect("/join?message=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("join_family_with_invite", {
    p_code: parsed.data.code
  });

  if (error) {
    if (error.message.includes("user_already_has_family")) {
      redirect("/");
    }

    if (error.message.includes("email_mismatch")) {
      redirect("/join?message=invalid");
    }

    redirect("/join?message=invalid");
  }

  redirect("/");
}
