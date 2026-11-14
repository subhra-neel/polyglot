import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";
import { HOME_AFTER_SIGN_IN, SIGN_IN_ROUTE, isAppRoute } from "@/lib/routes";

/**
 * Runs before every page request. It does two jobs:
 *   1. keeps the learner's session fresh (Supabase tokens expire hourly);
 *   2. sends signed-out visitors away from the app, and signed-in learners
 *      away from the sign-in page.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const env = getSupabaseEnv();

  // Not connected to Supabase yet: the sign-in page explains what to do.
  if (!env) {
    return isAppRoute(pathname) ? redirectTo(request, SIGN_IN_ROUTE) : NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Validates the token and refreshes it when needed. Do not remove.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && isAppRoute(pathname)) {
    const target = redirectTo(request, SIGN_IN_ROUTE, { next: pathname });
    copyCookies(response, target);
    return target;
  }

  if (signedIn && (pathname === "/" || pathname === SIGN_IN_ROUTE)) {
    const target = redirectTo(request, HOME_AFTER_SIGN_IN);
    copyCookies(response, target);
    return target;
  }

  return response;
}

function redirectTo(request: NextRequest, pathname: string, params: Record<string, string> = {}) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

/** A refreshed session must survive the redirect, or the learner is signed out. */
function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
