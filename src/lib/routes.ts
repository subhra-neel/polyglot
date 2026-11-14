/** Routes that need a signed-in learner. Everything under the five tabs. */
export const APP_ROUTES = ["/today", "/learn", "/talk", "/build", "/me"] as const;

export const SIGN_IN_ROUTE = "/sign-in";
export const HOME_AFTER_SIGN_IN = "/today";

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Where to send someone after signing in. Only same-site app paths are
 * accepted, so a crafted link cannot bounce a learner to another website.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return HOME_AFTER_SIGN_IN;
  }
  const pathname = next.split(/[?#]/)[0];
  return isAppRoute(pathname) ? next : HOME_AFTER_SIGN_IN;
}
