"use server";

import { redirect } from "next/navigation";

import { authCredentialsSchema } from "@/src/domain/schemas";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function signUpAction(formData: FormData) {
  const parsed = authCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect("/signup?message=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    redirect("/signup?message=invalid");
  }

  if (!data.session) {
    redirect("/login?message=check-email");
  }

  redirect("/onboarding");
}
