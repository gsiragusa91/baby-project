import { createClient } from "@supabase/supabase-js";

import { supabaseUrl } from "./config";

/**
 * Cliente "admin" con la SERVICE ROLE key.
 *
 * ¿Por qué existe este cliente aparte del de server.ts?
 * - server.ts usa la ANON key + las cookies del usuario logueado, así que
 *   respeta Row Level Security (RLS): solo ve/escribe lo que ese usuario puede.
 * - Este cliente lo usa el dispatcher de recordatorios, que corre desde un cron
 *   SIN ningún usuario logueado (no hay cookies, no hay sesión). Necesita la
 *   service-role key, que SALTEA RLS y puede leer/escribir cualquier fila.
 *
 * ⚠️ La service-role key es una llave maestra: NUNCA debe llegar al navegador.
 *    Por eso este archivo solo se importa desde código de servidor (API routes).
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cliente admin."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // No queremos que este cliente persista ni refresque sesiones:
      // es stateless, se crea por request y muere.
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
