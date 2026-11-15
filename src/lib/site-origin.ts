import "server-only";
import { headers } from "next/headers";

/**
 * The address this request arrived at, e.g. https://polyglot.vercel.app.
 * Used to build the link in password-reset emails. Supabase only sends
 * learners to addresses on its Redirect URLs list, so a forged Host header
 * cannot send a reset link somewhere else.
 */
export async function getSiteOrigin(): Promise<string> {
  return originFromHeaders(await headers());
}

/** Same, from a request's headers (for route handlers). */
export function originFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
