import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { originFromHeaders } from "@/lib/site-origin";
import { FORGOT_PASSWORD_ROUTE, RESET_PASSWORD_ROUTE, SIGN_IN_ROUTE, safeNextPath } from "@/lib/routes";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Where links in Supabase emails land (sign-up confirmation, password reset).
 * Accepts both link styles Supabase can send:
 *   ?token_hash=…&type=…  (the recommended email template; works on any device)
 *   ?code=…               (Supabase's default template; must be opened in the
 *                          same browser that asked for the email)
 * Either way the learner is signed in, then sent on to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // The address the learner actually used. request.nextUrl can report the
  // server's own name instead, and a redirect there would lose the session
  // cookie just set.
  const origin = originFromHeaders(request.headers);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next") ?? (type === "recovery" ? RESET_PASSWORD_ROUTE : null));

  const supabase = await createSupabaseServerClient();
  let ok = false;

  if (supabase && tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (supabase && code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  if (ok) return NextResponse.redirect(new URL(next, origin));

  // A failed reset link goes back to "forgot password" to try again.
  const fallback = next.startsWith(RESET_PASSWORD_ROUTE) ? FORGOT_PASSWORD_ROUTE : SIGN_IN_ROUTE;
  const url = new URL(fallback, origin);
  url.searchParams.set("link", "expired");
  return NextResponse.redirect(url);
}
