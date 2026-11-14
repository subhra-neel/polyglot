import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Returns null when the project has not been connected to Supabase yet.
 */
export async function createSupabaseServerClient() {
  // Read cookies first so every caller is treated as request-time code,
  // whether or not the project is connected yet.
  const cookieStore = await cookies();

  // Session checks compare token expiry with the current time, so this must
  // only ever run for a live request, never while prerendering or prefetching.
  await connection();

  const env = getSupabaseEnv();
  if (!env) return null;

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the
          // session on every request, so this is safe to ignore.
        }
      },
    },
  });
}
