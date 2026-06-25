"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const emailSchema = z.string().trim().email().max(320);

async function getOrigin() {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";

  return `${proto}://${host}`;
}

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));

  if (!parsed.success) {
    redirect("/reset?message=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  // Le pedimos a Supabase que mande el mail de recuperación. El link del mail
  // va a volver a /auth/callback con un código, que ahí cambiamos por sesión.
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=/reset/update`
  });

  // Siempre redirigimos al mismo mensaje, exista o no la cuenta: así no le
  // revelamos a un atacante qué emails están registrados (email enumeration).
  redirect("/reset?message=sent");
}
