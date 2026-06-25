import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  // Solo permitimos rutas internas (evita open-redirect a sitios externos).
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  // Detrás del proxy de Vercel, request.url no siempre trae el dominio público.
  // x-forwarded-host sí, así que lo usamos para armar el redirect final.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const baseUrl =
    !isLocal && forwardedHost ? `https://${forwardedHost}` : url.origin;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/reset?message=expired`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${baseUrl}/reset?message=expired`);
  }

  return NextResponse.redirect(`${baseUrl}${next}`);
}
