"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LANGUAGE, isSlug } from "@/lib/lessons";

export type CompleteState = { done?: boolean; queued?: number; error?: string };
export type FlagState = { sent?: boolean; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function completeLesson(_previous: CompleteState, formData: FormData): Promise<CompleteState> {
  const unit = String(formData.get("unit") ?? "");
  const lesson = String(formData.get("lesson") ?? "");
  if (!isSlug(unit) || !isSlug(lesson)) return { error: "Unknown lesson." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Not connected to Supabase." };

  const { data, error } = await supabase.rpc("complete_lesson", {
    p_unit_slug: unit,
    p_lesson_slug: lesson,
    p_language: LANGUAGE,
  });
  if (error) return { error: "Could not save. Check your connection and try again." };
  return { done: true, queued: Number(data) || 0 };
}

export async function flagSentence(_previous: FlagState, formData: FormData): Promise<FlagState> {
  const sentenceId = String(formData.get("sentence") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 500);
  if (!UUID.test(sentenceId)) return { error: "Unknown sentence." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Not connected to Supabase." };

  const { error } = await supabase.rpc("flag_sentence", { p_sentence_id: sentenceId, p_note: note });
  if (error) return { error: "Could not send. Try again." };
  return { sent: true };
}
