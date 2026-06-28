// Diagnóstico read-only: ¿quedó algo guardado por voz en el backend?
// Se loguea con BABY_TEST_PARENT_EMAIL/PASSWORD (los lee de .env.local) y lista
// las filas con source='voice' en las 3 tablas + revisa voice_parse_logs.
// No escribe nada. Borralo cuando termine el diagnóstico.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");

function loadEnvFile() {
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = value.replace(/^["']|["']$/g, "");
  }
}

function die(msg, detail) {
  console.error(`\nFAIL ${msg}`);
  if (detail) console.error(detail);
  process.exit(1);
}

loadEnvFile();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.BABY_TEST_PARENT_EMAIL;
const password = process.env.BABY_TEST_PARENT_PASSWORD;

if (!url || !anon) die("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY en .env.local.");
if (!email || !password)
  die(
    "Faltan credenciales.",
    "Seteá BABY_TEST_PARENT_EMAIL y BABY_TEST_PARENT_PASSWORD en .env.local (un usuario con familia)."
  );

const supabase = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: auth, error: signInError } = await supabase.auth.signInWithPassword({
  email,
  password
});
if (signInError || !auth.user) die("No pude loguearme.", signInError?.message);
console.log(`PASS Logueado: ${auth.user.email}`);

// Listar filas por voz en cada tabla. RLS deja ver solo las de la familia del usuario.
async function dump(table, orderCol, cols) {
  const { data, error } = await supabase
    .from(table)
    .select(cols)
    .eq("source", "voice")
    .order(orderCol, { ascending: false })
    .limit(10);
  if (error) {
    console.log(`\n[${table}] ERROR: ${error.message}`);
    return;
  }
  console.log(`\n[${table}] filas con source='voice': ${data.length}`);
  for (const row of data) console.log("  ", JSON.stringify(row));
}

await dump("diaper_events", "created_at", "id, created_at, event_time, diaper_type, transcript");
await dump("feeding_events", "created_at", "id, created_at, started_at, transcript");
await dump("questions", "created_at", "id, created_at, text, transcript");

// voice_parse_logs: por diseño actual no se escribe; lo confirmamos empíricamente.
const { data: logs, error: logsError } = await supabase
  .from("voice_parse_logs")
  .select("id, created_at, detected_intent, accepted, discarded, error")
  .order("created_at", { ascending: false })
  .limit(10);
if (logsError) console.log(`\n[voice_parse_logs] ERROR: ${logsError.message}`);
else {
  console.log(`\n[voice_parse_logs] filas: ${logs.length}`);
  for (const row of logs) console.log("  ", JSON.stringify(row));
}

await supabase.auth.signOut();
