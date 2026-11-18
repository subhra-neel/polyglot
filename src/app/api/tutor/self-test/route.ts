import { NextResponse } from "next/server";
import { getChatProvider } from "@/lib/llm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkLearnerLine } from "@/lib/tutor/check";
import { GOLDEN, GOLDEN_SCENE } from "@/lib/tutor/golden";
import { toRoman, toStoredCorrection } from "@/lib/tutor/turn";

export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/** Runs the fixed test lines through the live checker. Signed-in learners only. */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getClaims()) ?? { data: null };
  if (!data?.claims?.sub) return json({ error: "Sign in first." }, 401);
  const provider = getChatProvider();
  if (!provider) return json({ error: "No SARVAM_API_KEY is set." }, 503);

  const started = Date.now();
  const results = new Array(GOLDEN.length);
  let next = 0;
  async function worker() {
    while (next < GOLDEN.length) {
      const i = next++;
      const c = GOLDEN[i];
      const t0 = Date.now();
      try {
        const check = await checkLearnerLine(provider!, { tutorLine: c.tutorLine, said: c.said, scenario: GOLDEN_SCENE });
        const shown = toStoredCorrection(check, c.said);
        results[i] = {
          id: c.id,
          said: c.said,
          tutor: toRoman(c.tutorLine),
          expect: c.expect,
          note: c.note,
          got: check.category,
          pass: c.expect.includes(check.category),
          corrected: shown.corrected_roman,
          explanation: [shown.what_was_wrong, shown.why].filter(Boolean).join(" "),
          ms: Date.now() - t0,
        };
      } catch (err) {
        results[i] = { id: c.id, said: c.said, tutor: toRoman(c.tutorLine), expect: c.expect, note: c.note, got: "failed", pass: false, explanation: err instanceof Error ? err.message.slice(0, 200) : "failed", ms: Date.now() - t0 };
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return json({ model: provider.name, passed: results.filter((r) => r.pass).length, total: results.length, ms: Date.now() - started, results });
}
