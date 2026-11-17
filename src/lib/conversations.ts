import "server-only";
import { ContentUnavailableError, LANGUAGE } from "@/lib/lessons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StoredCorrection } from "@/lib/tutor/turn";

export type ScenarioSummary = {
  slug: string;
  title: string;
  setting: string;
  goals: string;
  opening_hint: string;
  conversations: number;
};

export type ConversationMessage = {
  id: number;
  role: "tutor" | "learner" | "system";
  roman: string;
  script: string | null;
  english: string | null;
  correction: (StoredCorrection & { aside?: string | null; checked?: boolean }) | null;
};

export type Conversation = {
  id: string;
  ended_at: string | null;
  scenario: { slug: string; title: string; persona: string; setting: string; goals: string; opening_hint: string };
  messages: ConversationMessage[];
};

export type ConversationSummary = {
  id: string;
  started_at: string;
  ended_at: string | null;
  title: string | null;
  turns: number;
  corrections: number;
};

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new ContentUnavailableError("Supabase is not connected.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new ContentUnavailableError(error.message);
  return data as T;
}

export const getScenarios = () => rpc<ScenarioSummary[]>("get_scenarios", { p_language: LANGUAGE });
export const getConversation = (id: string) => rpc<Conversation | null>("get_conversation", { p_id: id });
export const listConversations = (limit = 10) => rpc<ConversationSummary[]>("list_conversations", { p_limit: limit });
export const getTutorContext = () =>
  rpc<{ level: number; mistakes: { tag: string; occurrences: number; example: unknown }[]; known_sentences: string[] }>(
    "get_tutor_context",
    { p_language: LANGUAGE },
  );

export const addMessage = (args: {
  conversationId: string;
  role: "tutor" | "learner";
  roman: string;
  script?: string | null;
  english?: string | null;
  correction?: unknown;
}) =>
  rpc<number>("add_message", {
    p_conversation_id: args.conversationId,
    p_role: args.role,
    p_text_roman: args.roman,
    p_text_script: args.script ?? null,
    p_gloss_en: args.english ?? null,
    p_correction: args.correction ?? null,
  });

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
