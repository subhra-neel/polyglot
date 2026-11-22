import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Practice over the last 30 days, by skill, from the learner's own events and tutor messages. */
export type PracticeStats = {
  days: number;
  activeDays: number;
  speaking: { attempts: number; clear: number };
  listening: { right: number; total: number };
  building: { right: number; total: number };
  translating: { right: number; total: number };
  conversation: { conversations: number; replies: number; correct: number; spoken: number };
};

export const EMPTY_STATS: PracticeStats = {
  days: 30,
  activeDays: 0,
  speaking: { attempts: 0, clear: 0 },
  listening: { right: 0, total: 0 },
  building: { right: 0, total: 0 },
  translating: { right: 0, total: 0 },
  conversation: { conversations: 0, replies: 0, correct: 0, spoken: 0 },
};

type EventRow = { name: string; props: Record<string, unknown>; created_at: string };
type MessageRow = { conversation_id: string; correction: { category?: string } | null; created_at: string };

const dayKey = (iso: string) => iso.slice(0, 10);

/** Pure summary, tested on its own. */
export function summarisePractice(events: EventRow[], messages: MessageRow[], days = 30): PracticeStats {
  const s: PracticeStats = structuredClone({ ...EMPTY_STATS, days });
  const active = new Set<string>();
  for (const e of events) {
    active.add(dayKey(e.created_at));
    if (e.name === "say_it") {
      s.speaking.attempts++;
      if (e.props.verdict === "clear") s.speaking.clear++;
    } else if (e.name === "check_answer") {
      const right = e.props.right === true ? 1 : 0;
      const bucket =
        e.props.kind === "listen" ? s.listening : e.props.kind === "translate" ? s.translating : s.building;
      bucket.total++;
      bucket.right += right;
    } else if (e.name === "voice_reply") {
      s.conversation.spoken++;
    }
  }
  const conversations = new Set<string>();
  for (const m of messages) {
    active.add(dayKey(m.created_at));
    conversations.add(m.conversation_id);
    s.conversation.replies++;
    const c = m.correction?.category;
    if (c === "none" || c === "valid_variant") s.conversation.correct++;
  }
  s.conversation.conversations = conversations.size;
  s.activeDays = active.size;
  return s;
}

export async function getPracticeStats(days = 30): Promise<PracticeStats> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return EMPTY_STATS;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [events, messages] = await Promise.all([
      supabase
        .from("events")
        .select("name, props, created_at")
        .in("name", ["say_it", "check_answer", "voice_reply"])
        .gte("created_at", since)
        .limit(5000),
      supabase
        .from("messages")
        .select("conversation_id, correction, created_at")
        .eq("role", "learner")
        .gte("created_at", since)
        .limit(5000),
    ]);
    if (events.error || messages.error) throw new Error((events.error ?? messages.error)!.message);
    return summarisePractice((events.data ?? []) as EventRow[], (messages.data ?? []) as MessageRow[], days);
  } catch (err) {
    console.error("[practice stats]", err instanceof Error ? err.message : err);
    return EMPTY_STATS;
  }
}
