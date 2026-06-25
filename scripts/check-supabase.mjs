import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");

function loadEnvFile() {
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

function fail(message, details) {
  console.error(`\nFAIL ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function info(message) {
  console.log(`INFO ${message}`);
}

loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const testEmail = process.env.BABY_TEST_PARENT_EMAIL;
const testPassword = process.env.BABY_TEST_PARENT_PASSWORD;

if (!supabaseUrl || !supabaseAnonKey) {
  fail(
    "Missing Supabase env vars.",
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
  );
}

const settingsUrl = new URL("/auth/v1/settings", supabaseUrl);

try {
  const response = await fetch(settingsUrl, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`
    }
  });

  if (!response.ok) {
    fail(
      "Supabase project did not accept the anon key.",
      `Auth settings returned HTTP ${response.status}.`
    );
  }

  pass("Supabase URL and anon key are reachable.");
} catch (error) {
  fail("Could not reach Supabase.", error instanceof Error ? error.message : String(error));
}

if (!testEmail || !testPassword) {
  info(
    "Skipping family/baby check. Add BABY_TEST_PARENT_EMAIL and BABY_TEST_PARENT_PASSWORD to .env.local to test login + seed."
  );
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
  email: testEmail,
  password: testPassword
});

if (signInError || !authData.user) {
  fail(
    "Could not sign in with BABY_TEST_PARENT_EMAIL.",
    signInError?.message ?? "No user returned."
  );
}

pass(`Signed in test parent: ${authData.user.email}`);

const { data: member, error: memberError } = await supabase
  .from("family_members")
  .select("family_id, role")
  .eq("user_id", authData.user.id)
  .limit(1)
  .maybeSingle();

if (memberError) {
  fail(
    "Could not read family_members.",
    `${memberError.message}. Did you run supabase/schema.sql?`
  );
}

if (!member) {
  fail(
    "Test parent has no family membership.",
    "Run supabase/seed.example.sql after replacing the example emails."
  );
}

pass(`Found family membership with role: ${member.role}`);

const { data: baby, error: babyError } = await supabase
  .from("babies")
  .select("id, name")
  .eq("family_id", member.family_id)
  .limit(1)
  .maybeSingle();

if (babyError) {
  fail("Could not read babies.", babyError.message);
}

if (!baby) {
  fail(
    "Family has no baby.",
    "Run supabase/seed.example.sql or insert one row into babies."
  );
}

pass(`Found active baby: ${baby.name}`);

await supabase.auth.signOut();
