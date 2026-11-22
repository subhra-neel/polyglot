"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Records one practice event (Say it, a unit-check answer, a spoken tutor
 * reply) in the learner's own events, so Me can show speaking, listening
 * and sentence-building practice. Best-effort: a failure never interrupts practice.
 */
const ALLOWED = {
  say_it: (p: Record<string, unknown>) => ({ verdict: ["clear", "nearly", "again"].includes(String(p.verdict)) ? p.verdict : "again" }),
  check_answer: (p: Record<string, unknown>) => ({
    kind: ["order", "listen", "gap", "translate"].includes(String(p.kind)) ? p.kind : "order",
    right: p.right === true,
  }),
  voice_reply: () => ({}),
} as const;

export type PracticeEvent = keyof typeof ALLOWED;

export async function logPractice(name: PracticeEvent, props: Record<string, unknown> = {}): Promise<void> {
  if (!(name in ALLOWED)) return;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = (await supabase?.auth.getClaims()) ?? { data: null };
    const userId = data?.claims?.sub;
    if (!supabase || !userId) return;
    await supabase.from("events").insert({ user_id: userId, name, props: ALLOWED[name](props) });
  } catch (err) {
    console.error("[practice]", err instanceof Error ? err.message : err);
  }
}
