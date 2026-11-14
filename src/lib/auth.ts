import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGN_IN_ROUTE } from "@/lib/routes";

export type CurrentUser = { id: string; email: string | null };

/**
 * The signed-in learner, or a redirect to the sign-in page.
 *
 * This reads the session cookie, so it must be called from a component that
 * sits inside a <Suspense> boundary (see the Next.js guide "Authentication
 * with Cache Components").
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(SIGN_IN_ROUTE);

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) redirect(SIGN_IN_ROUTE);

  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
