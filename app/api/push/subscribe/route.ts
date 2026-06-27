import { NextResponse } from "next/server";

import { getFamilyContext } from "@/src/data/context";

export const runtime = "nodejs";

/**
 * Guarda (o actualiza) la suscripción Web Push del navegador actual.
 *
 * El cliente nos manda el objeto PushSubscription serializado:
 *   { endpoint, keys: { p256dh, auth } }
 *
 * Lo asociamos al usuario logueado y su familia. Si ya existe esa suscripción
 * (mismo endpoint), la actualizamos (upsert por endpoint).
 */
export async function POST(request: Request) {
  const context = await getFamilyContext();

  if (context.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (context.status === "missing-family") {
    return NextResponse.json({ error: "missing-family" }, { status: 409 });
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "incomplete-subscription" }, { status: 400 });
  }

  const { error } = await context.supabase.from("push_subscriptions").upsert(
    {
      family_id: context.familyId,
      user_id: context.user.id,
      endpoint,
      p256dh,
      auth
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
