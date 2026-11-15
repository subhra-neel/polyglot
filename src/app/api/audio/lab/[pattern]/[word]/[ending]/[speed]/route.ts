import type { NextRequest } from "next/server";
import { build } from "@/lib/patterns";
import { audioError, audioPreflight, speechResponse } from "@/lib/tts/respond";

/**
 * Audio for a sentence built in the lab. The sentence is rebuilt here from
 * the checked pattern data, so only real lab sentences can be spoken.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/audio/lab/[pattern]/[word]/[ending]/[speed]">,
) {
  const { pattern, word, ending, speed } = await params;
  const sentence = build(pattern, word, ending);
  if (!sentence || (speed !== "normal" && speed !== "slow")) return audioError(404, "Not found.");

  const pre = await audioPreflight();
  if (pre.error) return pre.error;

  return speechResponse(sentence.script, "kn-IN", speed);
}
