import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { sendPushToSubscriptions, type StoredSubscription } from "@/src/lib/push";
import { announceOnAlexa, triggerAlexaRoutine } from "@/src/lib/voicemonkey";

// Este endpoint hace I/O con la base y con servicios externos: runtime Node.
export const runtime = "nodejs";

type DueReminder = {
  id: string;
  family_id: string;
  baby_id: string;
  remind_at: string;
  related_event_type: string;
  // El embedded select de Supabase puede venir como objeto o array según infiera
  // la relación; lo normalizamos en babyName().
  babies: { name: string } | { name: string }[] | null;
};

function babyName(reminder: DueReminder): string {
  const b = reminder.babies;
  if (!b) return "tu bebé";
  return Array.isArray(b) ? b[0]?.name ?? "tu bebé" : b.name;
}

/**
 * Dispara los recordatorios vencidos. Lo llama pg_cron cada minuto con un
 * header secreto. Sin usuario logueado → cliente admin (service-role).
 */
export async function POST(request: Request) {
  // 1. Autenticación del cron.
  const provided = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // 2. Recordatorios vencidos y no enviados (traemos el nombre del bebé).
  const { data, error: fetchError } = await supabase
    .from("reminders")
    .select("id, family_id, baby_id, remind_at, related_event_type, babies(name)")
    .eq("status", "scheduled")
    .lte("remind_at", new Date().toISOString());

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const dueReminders = (data ?? []) as DueReminder[];
  if (dueReminders.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of dueReminders) {
    try {
      const name = babyName(reminder);
      const payload = {
        title: "Baby's Project",
        body: `Es hora de la próxima toma de ${name}.`,
        url: "/",
        tag: `reminder-${reminder.id}`
      };

      // 3a. Web Push: suscripciones de toda la familia (cualquier dispositivo).
      const { data: subsData } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("family_id", reminder.family_id);

      const subs = (subsData ?? []) as StoredSubscription[];
      if (subs.length > 0) {
        const results = await sendPushToSubscriptions(subs, payload);

        // Limpiamos las suscripciones muertas (404/410) para no reintentarlas.
        const expired = results.filter((r) => r.expired).map((r) => r.endpoint);
        if (expired.length > 0) {
          await supabase.from("push_subscriptions").delete().in("endpoint", expired);
        }
      }

      // 3b. Alexa: anuncio por voz + (si está configurada) una rutina más
      //     llamativa (canción/alarma). Ambas best-effort, no bloquean.
      await announceOnAlexa(`Recordatorio: es hora de la próxima toma de ${name}.`);
      await triggerAlexaRoutine();

      // 4. Marcamos enviado (aunque no haya suscripciones: ya lo "procesamos",
      //    no queremos que el cron lo reintente para siempre).
      const { error: updateError } = await supabase
        .from("reminders")
        .update({ status: "sent" })
        .eq("id", reminder.id);
      if (updateError) throw new Error(updateError.message);

      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`[dispatch] falló reminder ${reminder.id}:`, err);
      await supabase.from("reminders").update({ status: "failed" }).eq("id", reminder.id);
    }
  }

  return NextResponse.json({ processed: dueReminders.length, sent, failed });
}
