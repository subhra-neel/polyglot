/**
 * Supabase connection settings.
 *
 * Both values are safe to expose to the browser: the key is the public
 * ("publishable" / "anon") key, and row-level security in the database is
 * what protects learner data. Secret keys never belong in NEXT_PUBLIC_ vars.
 *
 * The app must still start when these are missing, so a fresh deployment
 * shows setup instructions instead of crashing.
 */
export type SupabaseEnv = { url: string; key: string };

type EnvSource = Record<string, string | undefined>;

export function readSupabaseEnv(source: EnvSource): SupabaseEnv | null {
  const url = source.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? source.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !key) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return null;
    }
  } catch {
    return null;
  }

  return { url, key };
}

// Next.js only inlines NEXT_PUBLIC_ variables that are referenced by their
// full literal name, so they are listed here rather than read dynamically.
export function getSupabaseEnv(): SupabaseEnv | null {
  return readSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
