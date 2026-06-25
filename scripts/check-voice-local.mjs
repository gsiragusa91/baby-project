import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

function warn(message) {
  console.log(`WARN ${message}`);
}

async function checkSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    fail(
      "Missing Supabase env vars.",
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }

  const response = await fetch(new URL("/auth/v1/settings", supabaseUrl), {
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
}

async function checkOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    fail(
      "Missing OPENAI_API_KEY.",
      "Add OPENAI_API_KEY to .env.local before testing voice."
    );
  }

  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    let details = `OpenAI returned HTTP ${response.status}.`;

    try {
      const body = await response.json();
      details = body?.error?.message ?? details;
    } catch {
      // Keep the generic HTTP details.
    }

    fail("OpenAI API key was rejected.", details);
  }

  pass("OpenAI API key is accepted.");
}

loadEnvFile();

await checkSupabase();
await checkOpenAI();

if (!process.env.BABY_TEST_PARENT_EMAIL || !process.env.BABY_TEST_PARENT_PASSWORD) {
  warn(
    "BABY_TEST_PARENT_EMAIL/PASSWORD are not set. Browser testing still works, but automated family checks are skipped."
  );
}

pass("Local voice prerequisites are ready.");
