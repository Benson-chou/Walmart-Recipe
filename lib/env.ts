/**
 * Environment helpers for local + Vercel production.
 * Keep secrets server-only (never NEXT_PUBLIC_* for SCRAPE_SECRET / service role / Gemini).
 */

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

/** True when Gemini chat/embed calls can run. */
export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/**
 * Validates scrape / cron secrets. Rejects empty or placeholder values in production.
 */
export function getScrapeSecret(): string | null {
  const secret = process.env.SCRAPE_SECRET?.trim();
  if (!secret) return null;
  if (isProduction() && /^(change-me|changeme|secret|test)$/i.test(secret)) {
    return null;
  }
  return secret;
}

/** Vercel Cron uses CRON_SECRET as Bearer token when configured. */
export function getCronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || getScrapeSecret();
}

export type EnvCheck = {
  key: string;
  ok: boolean;
  required: boolean;
  note?: string;
};

/** Server-side checklist for deploy readiness (never expose secret values). */
export function checkRequiredEnv(): EnvCheck[] {
  return [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      required: true,
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      required: true,
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: true,
      note: "Needed for flyer cache, embeddings, and match_recipes RPC",
    },
    {
      key: "GEMINI_API_KEY",
      ok: hasGeminiKey(),
      required: true,
      note: "Needed for generate + embeddings",
    },
    {
      key: "SCRAPE_SECRET",
      ok: Boolean(getScrapeSecret()),
      required: true,
      note: "Protects /api/admin/scrape — use a long random string in production",
    },
    {
      key: "CRON_SECRET",
      ok: Boolean(process.env.CRON_SECRET?.trim() || getScrapeSecret()),
      required: false,
      note: "Optional; Vercel Cron Authorization. Falls back to SCRAPE_SECRET",
    },
    {
      key: "GEMINI_CHAT_MODEL",
      ok: true,
      required: false,
      note: process.env.GEMINI_CHAT_MODEL || "defaults to gemini-3.5-flash-lite",
    },
  ];
}

export function assertProductionSecrets(): { ok: boolean; missing: string[] } {
  const missing = checkRequiredEnv()
    .filter((c) => c.required && !c.ok)
    .map((c) => c.key);
  return { ok: missing.length === 0, missing };
}
