"use server";

import { redirect } from "next/navigation";

import { onboardingInputSchema } from "@/src/domain/schemas";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function createInitialFamilyAction(formData: FormData) {
  const parsed = onboardingInputSchema.safeParse({
    familyName: formData.get("familyName"),
    babyName: formData.get("babyName"),
    babyBirthDate: formData.get("babyBirthDate")
  });

  if (!parsed.success) {
    redirect("/onboarding?message=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const familyName = parsed.data.familyName || null;
  const { error } = await supabase.rpc("create_initial_family", {
    p_baby_birth_date: parsed.data.babyBirthDate,
    p_baby_name: parsed.data.babyName,
    p_family_name: familyName
  });

  if (error) {
    if (error.message.includes("user_already_has_family")) {
      redirect("/");
    }

    redirect("/onboarding?message=save-failed");
  }

  redirect("/");
}
