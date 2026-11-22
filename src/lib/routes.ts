/** Routes that need a signed-in learner: everything behind the tabs (/today now redirects home). */
export const APP_ROUTES = ["/today", "/learn", "/practice", "/review", "/talk", "/build", "/me"] as const;

export const SIGN_IN_ROUTE = "/sign-in";
export const HOME_AFTER_SIGN_IN = "/learn";
export const FORGOT_PASSWORD_ROUTE = "/forgot-password";
/** Where a password-reset email link lands, once the link has signed the learner in. */
export const RESET_PASSWORD_ROUTE = "/reset-password";

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Where to send someone after signing in. Only same-site app paths (and the
 * reset-password page) are accepted, so a crafted link cannot bounce a
 * learner to another website.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return HOME_AFTER_SIGN_IN;
  }
  const pathname = next.split(/[?#]/)[0];
  return isAppRoute(pathname) || pathname === RESET_PASSWORD_ROUTE ? next : HOME_AFTER_SIGN_IN;
}
