import { NextResponse, type NextRequest } from "next/server";
import { LANGUAGE } from "@/lib/lessons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TtsError, getTtsProvider } from "@/lib/tts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LANGUAGE_CODES: Record<string, string> = { kn: "kn-IN", ta: "ta-IN", te: "te-IN" };

// A year: the address changes whenever the audio would (see audioUrlsFor),
// so a stored copy never goes stale. `s-maxage` lets Vercel's CDN keep it
// too, so each sentence is generated (and paid for) about once.
const CACHE_FOREVER = "public, max-age=31536000, s-maxage=31536000, immutable";

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });

/**
 * Audio for one sentence: /api/audio/<sentence id>/<normal|slow>.
 * Only signed-in learners can trigger generation, and only for sentences
 * they can see (row-level security hides drafts).
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/audio/[id]/[speed]">) {
  const { id, speed } = await params;
  if (!UUID.test(id) || (speed !== "normal" && speed !== "slow")) return fail(404, "Not found.");

  const provider = getTtsProvider();
  if (!provider) return fail(503, "No voice service is set up.");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail(503, "Not connected to Supabase.");

  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return fail(401, "Sign in to play audio.");

  const { data: sentence, error } = await supabase
    .from("sentences")
    .select("text_script, language_code")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail(500, "Could not read the sentence.");
  if (!sentence?.text_script) return fail(404, "Not found.");

  try {
    const { audio, contentType } = await provider.synthesize({
      text: sentence.text_script,
      languageCode: LANGUAGE_CODES[sentence.language_code ?? LANGUAGE] ?? "kn-IN",
      speed,
    });
    return new Response(audio.buffer as ArrayBuffer, {
      headers: { "content-type": contentType, "content-length": String(audio.byteLength), "cache-control": CACHE_FOREVER },
    });
  } catch (err) {
    console.error("[audio]", err instanceof Error ? err.message : err);
    return fail(err instanceof TtsError && err.status === 429 ? 429 : 502, "The voice service did not answer.");
  }
}
