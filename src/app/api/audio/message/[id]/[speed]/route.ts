import type { NextRequest } from "next/server";
import { audioError, audioPreflight, speechResponse } from "@/lib/tts/respond";

/** Audio for one of the tutor's lines, readable only by the learner in that conversation. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/audio/message/[id]/[speed]">) {
  const { id, speed } = await params;
  if (!/^\d{1,18}$/.test(id) || (speed !== "normal" && speed !== "slow")) return audioError(404, "Not found.");

  const pre = await audioPreflight();
  if (pre.error) return pre.error;

  const { data: message, error } = await pre.supabase
    .from("messages")
    .select("text_script")
    .eq("id", id)
    .eq("role", "tutor")
    .maybeSingle();
  if (error) return audioError(500, "Could not read the message.");
  if (!message?.text_script) return audioError(404, "Not found.");

  return speechResponse(message.text_script, "kn-IN", speed);
}
