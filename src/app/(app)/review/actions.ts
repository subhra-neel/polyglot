"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReviewCard, type QueueCard } from "@/lib/progress";
import { type Answer, ANSWERS, previewIntervals, schedule } from "@/lib/srs";

export type GradeResult =
  | { ok: true; card: QueueCard; previews: Record<Answer, string>; dueSoon: boolean }
  | { ok: false; error: string };

/** Schedules the card with FSRS and stores the result. */
export async function gradeCard(cardId: number, answer: Answer): Promise<GradeResult> {
  if (!Number.isInteger(cardId) || cardId <= 0 || !ANSWERS.includes(answer)) {
    return { ok: false, error: "Unknown card." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Not connected." };

  let card: QueueCard | null;
  try {
    card = await getReviewCard(cardId);
  } catch {
    return { ok: false, error: "Could not load the card. Try again." };
  }
  if (!card) return { ok: false, error: "Unknown card." };

  const now = new Date();
  const next = schedule(card, answer, now);
  const { error } = await supabase.rpc("record_review", {
    p_card_id: cardId,
    p_rating: next.rating,
    p_due: next.due.toISOString(),
    p_stability: next.stability,
    p_difficulty: next.difficulty,
    p_elapsed_days: next.elapsed_days,
    p_scheduled_days: next.scheduled_days,
    p_learning_steps: next.learning_steps,
    p_reps: next.reps,
    p_lapses: next.lapses,
    p_state: next.state,
  });
  if (error) return { ok: false, error: "Could not save. Check your connection and try again." };

  const updated: QueueCard = {
    ...card,
    ...next,
    due: next.due.toISOString(),
    last_review: now.toISOString(),
  };
  // A sentence answered "Again" is due within minutes: show it once more
  // before this session ends. Anything later waits for its next session.
  const dueSoon = next.due.getTime() - now.getTime() <= 5 * 60_000;
  return { ok: true, card: updated, previews: previewIntervals(updated, now), dueSoon };
}
