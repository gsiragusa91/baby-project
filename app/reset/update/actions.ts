"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const passwordSchema = z.string().min(6).max(72);

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const parsed = passwordSchema.safeParse(password);

  if (!parsed.success || password !== confirm) {
    redirect("/reset/update?message=invalid");
  }

  const supabase = await createSupabaseServerClient();
  // updateUser solo funciona si hay sesión activa. La sesión la dejó el
  // /auth/callback al canjear el código del mail, así que acá ya estamos logueados.
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect("/reset/update?message=failed");
  }

  redirect("/");
}
