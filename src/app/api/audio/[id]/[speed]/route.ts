import type { NextRequest } from "next/server";
import { LANGUAGE } from "@/lib/lessons";
import { audioError, audioPreflight, speechResponse } from "@/lib/tts/respond";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LANGUAGE_CODES: Record<string, string> = { kn: "kn-IN", ta: "ta-IN", te: "te-IN" };

/**
 * Audio for one lesson sentence: /api/audio/<sentence id>/<normal|slow>.
 * Only signed-in learners can trigger generation, and only for sentences
 * they can see (row-level security hides drafts).
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/audio/[id]/[speed]">) {
  const { id, speed } = await params;
  if (!UUID.test(id) || (speed !== "normal" && speed !== "slow")) return audioError(404, "Not found.");

  const pre = await audioPreflight();
  if (pre.error) return pre.error;

  const { data: sentence, error } = await pre.supabase
    .from("sentences")
    .select("text_script, language_code")
    .eq("id", id)
    .maybeSingle();
  if (error) return audioError(500, "Could not read the sentence.");
  if (!sentence?.text_script) return audioError(404, "Not found.");

  return speechResponse(sentence.text_script, LANGUAGE_CODES[sentence.language_code ?? LANGUAGE] ?? "kn-IN", speed);
}
