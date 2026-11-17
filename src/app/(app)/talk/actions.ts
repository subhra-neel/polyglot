"use server";

import { redirect } from "next/navigation";
import {
  type ConversationMessage,
  UUID,
  addMessage,
  getConversation,
  getTutorContext,
} from "@/lib/conversations";
import { isSlug, LANGUAGE } from "@/lib/lessons";
import { getChatProvider } from "@/lib/llm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type HistoryItem, nextTutorTurn } from "@/lib/tutor/run";
import { checkLearnerLine } from "@/lib/tutor/check";
import { type LineCheck, type StoredCorrection, toRoman, toStoredCorrection } from "@/lib/tutor/turn";

/** Shown when the check itself failed: an English aside can still be shown. */
const UNCHECKED: StoredCorrection = {
  category: "none",
  meant: null,
  corrected_roman: null,
  corrected_script: null,
  what_was_wrong: null,
  why: null,
  natural_roman: null,
  natural_script: null,
  tags: [],
};

const MAX_INPUT = 300;

export async function startConversation(formData: FormData) {
  const slug = String(formData.get("scenario") ?? "");
  if (!isSlug(slug)) redirect("/talk");

  const supabase = await createSupabaseServerClient();
  const provider = getChatProvider();
  if (!supabase || !provider) redirect("/talk?error=setup");

  const { data: id, error } = await supabase.rpc("start_conversation", { p_scenario_slug: slug, p_language: LANGUAGE });
  if (error || typeof id !== "string") redirect("/talk?error=start");

  // The tutor opens the scene. If that fails, the conversation page offers to retry.
  try {
    const [conversation, context] = await Promise.all([getConversation(id), getTutorContext()]);
    if (conversation) {
      const turn = await nextTutorTurn(provider, conversation.scenario, context, []);
      await addMessage({
        conversationId: id,
        role: "tutor",
        roman: toRoman(turn.reply_kannada),
        script: turn.reply_kannada,
        english: turn.reply_english,
      });
    }
  } catch (err) {
    console.error("[tutor] opening failed", err instanceof Error ? err.message : err);
  }
  redirect(`/talk/c/${id}`);
}

export type SendResult =
  | { ok: true; learner: ConversationMessage; tutor: ConversationMessage }
  | { ok: false; error: string };

/** Sends the learner's line (or none, to ask the tutor to open the scene). */
export async function sendMessage(conversationId: string, text: string): Promise<SendResult> {
  const said = text.trim().replace(/\s+/g, " ").slice(0, MAX_INPUT);
  if (!UUID.test(conversationId)) return { ok: false, error: "Unknown conversation." };

  const provider = getChatProvider();
  if (!provider) return { ok: false, error: "The tutor is not set up yet (no SARVAM_API_KEY)." };

  try {
    const [conversation, context] = await Promise.all([getConversation(conversationId), getTutorContext()]);
    if (!conversation) return { ok: false, error: "Unknown conversation." };
    if (conversation.ended_at) return { ok: false, error: "This conversation has finished. Start a new one." };

    const history: HistoryItem[] = conversation.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "tutor" | "learner", text: m.role === "tutor" ? (m.script ?? m.roman) : m.roman }));
    if (said) history.push({ role: "learner", text: said });

    // 1. Check the learner's line on its own (a failed check still lets the scene go on).
    let check: LineCheck | null = null;
    if (said) {
      const tutorLine = [...conversation.messages].reverse().find((m) => m.role === "tutor");
      check = await checkLearnerLine(provider, {
        tutorLine: tutorLine?.script ?? tutorLine?.roman ?? null,
        said,
        scenario: conversation.scenario,
        recurring: context.mistakes.map((m) => m.tag),
      }).catch((err) => {
        console.error("[tutor] check failed", err instanceof Error ? err.message : err);
        return null;
      });
    }

    // 2. The character replies, knowing what the learner meant.
    const turn = await nextTutorTurn(provider, conversation.scenario, context, history, check);
    const aside = turn.aside_english.trim() || null;
    const correction = said ? (check ? { ...toStoredCorrection(check), aside } : aside ? { ...UNCHECKED, aside, checked: false } : null) : null;

    let learner: ConversationMessage | null = null;
    if (said) {
      const learnerId = await addMessage({ conversationId, role: "learner", roman: said, correction });
      learner = { id: learnerId, role: "learner", roman: said, script: null, english: null, correction };
      if (correction && correction.tags.length) {
        const supabase = await createSupabaseServerClient();
        await supabase?.rpc("record_mistakes", {
          p_language: LANGUAGE,
          p_tags: correction.tags,
          p_example: { said, corrected: correction.corrected_roman },
        });
      }
    }

    const roman = toRoman(turn.reply_kannada);
    const tutorId = await addMessage({
      conversationId,
      role: "tutor",
      roman,
      script: turn.reply_kannada,
      english: turn.reply_english,
    });
    const tutor: ConversationMessage = {
      id: tutorId,
      role: "tutor",
      roman,
      script: turn.reply_kannada,
      english: turn.reply_english,
      correction: null,
    };
    return learner ? { ok: true, learner, tutor } : { ok: true, learner: { ...tutor, id: -1 }, tutor };
  } catch (err) {
    console.error("[tutor]", err instanceof Error ? err.message : err);
    return { ok: false, error: "The tutor didn't answer. Check your connection and try again." };
  }
}

export async function endConversation(conversationId: string): Promise<void> {
  if (!UUID.test(conversationId)) return;
  const supabase = await createSupabaseServerClient();
  await supabase?.rpc("end_conversation", { p_id: conversationId });
}
