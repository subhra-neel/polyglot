import { NextResponse, type NextRequest } from "next/server";
import { getSttProvider, SttError } from "@/lib/stt";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toRoman } from "@/lib/tutor/turn";

export const maxDuration = 30;

const MAX_BYTES = 3 * 1024 * 1024; // about 30 s of compressed speech
const AUDIO_TYPES = /^audio\/(webm|mp4|ogg|wav|x-wav|mpeg|aac|x-m4a)\b/;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * Turns a short recording into text for the tutor's reply box. Kannada comes
 * back in Kannada script and is shown in the app's English letters; English
 * words stay as they are. Signed-in learners only.
 */
export async function POST(request: NextRequest) {
  const provider = getSttProvider();
  if (!provider) return json({ error: "Voice input is not set up (no SARVAM_API_KEY)." }, 503);

  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getClaims()) ?? { data: null };
  if (!data?.claims?.sub) return json({ error: "Sign in first." }, 401);

  const type = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!AUDIO_TYPES.test(type)) return json({ error: "Send audio." }, 415);
  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) return json({ error: "The recording was empty." }, 400);
  if (audio.byteLength > MAX_BYTES) return json({ error: "Keep it under 30 seconds." }, 413);

  try {
    const transcript = await provider.transcribe(new Blob([audio], { type: type.split(";")[0] }), "kn-IN");
    const text = toRoman(transcript);
    return json({ text, script: transcript });
  } catch (err) {
    console.error("[stt]", err instanceof Error ? err.message : err);
    const status = err instanceof SttError && err.status === 429 ? 429 : 502;
    return json({ error: "Couldn't hear that. Try again, or type instead." }, status);
  }
}
