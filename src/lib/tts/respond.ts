import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TtsError, getTtsProvider, type Speed } from "./index";

// A year: the address changes whenever the audio would (see audio URL
// helpers), so a stored copy never goes stale. `s-maxage` lets Vercel's CDN
// keep it too, so each sentence is generated (and paid for) about once.
const CACHE_FOREVER = "public, max-age=31536000, s-maxage=31536000, immutable";

export const audioError = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });

/** Checks the voice service and the session; returns a Supabase client or an error response. */
export async function audioPreflight() {
  if (!getTtsProvider()) return { error: audioError(503, "No voice service is set up.") } as const;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: audioError(503, "Not connected to Supabase.") } as const;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: audioError(401, "Sign in to play audio.") } as const;
  return { supabase } as const;
}

/** Speaks `text` (Kannada script) and returns it as a cacheable MP3 response. */
export async function speechResponse(text: string, languageCode: string, speed: Speed): Promise<Response> {
  const provider = getTtsProvider();
  if (!provider) return audioError(503, "No voice service is set up.");
  try {
    const { audio, contentType } = await provider.synthesize({ text, languageCode, speed });
    return new Response(audio.buffer as ArrayBuffer, {
      headers: { "content-type": contentType, "content-length": String(audio.byteLength), "cache-control": CACHE_FOREVER },
    });
  } catch (err) {
    console.error("[audio]", err instanceof Error ? err.message : err);
    return audioError(err instanceof TtsError && err.status === 429 ? 429 : 502, "The voice service did not answer.");
  }
}
