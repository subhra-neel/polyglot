import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGN_IN_ROUTE, safeNextPath } from "@/lib/routes";

/**
 * Landing point for the link in Supabase's confirmation email.
 * Exchanges the one-time token for a session, then enters the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const destination = request.nextUrl.clone();
  destination.search = "";

  const supabase = await createSupabaseServerClient();
  if (supabase && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      destination.pathname = safeNextPath(searchParams.get("next"));
      return NextResponse.redirect(destination);
    }
  }

  destination.pathname = SIGN_IN_ROUTE;
  return NextResponse.redirect(destination);
}
