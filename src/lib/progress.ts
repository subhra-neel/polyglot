import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContentUnavailableError, LANGUAGE } from "@/lib/lessons";
import type { StoredCard } from "@/lib/srs";

export type Progress = {
  daily_review_goal: number;
  show_english: boolean;
  show_script: boolean;
  time_zone: string;
  due_now: number;
  due_today: number;
  reviewed_today: number;
  sentences_started: number;
  sentences_retained: number;
  reviews_30d: number;
  recall_rate_30d: number | null;
  lessons_completed: number;
  next_lesson: {
    unit_slug: string;
    unit_title: string;
    unit_position: number;
    lesson_slug: string;
    lesson_title: string;
  } | null;
  flags_open: number;
};

export type CardSentence = {
  id: string;
  roman: string;
  script: string | null;
  meaning: string;
  why: string | null;
  formality: "neutral" | "respectful" | "casual";
  register: "neutral" | "colloquial" | "formal";
};

export type QueueCard = StoredCard & { sentence: CardSentence };

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new ContentUnavailableError("Supabase is not connected.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new ContentUnavailableError(error.message);
  return data as T;
}

export const getProgress = () => rpc<Progress>("get_progress", { p_language: LANGUAGE });
export const getReviewQueue = (limit = 20) => rpc<QueueCard[]>("get_review_queue", { p_limit: limit });
export const getReviewCard = (id: number) => rpc<QueueCard | null>("get_review_card", { p_card_id: id });
