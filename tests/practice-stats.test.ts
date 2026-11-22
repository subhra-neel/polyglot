import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => null }));

const { summarisePractice } = await import("@/lib/practice-stats");

describe("summarisePractice", () => {
  it("counts each skill and active days", () => {
    const s = summarisePractice(
      [
        { name: "say_it", props: { verdict: "clear" }, created_at: "2026-11-20T10:00:00Z" },
        { name: "say_it", props: { verdict: "nearly" }, created_at: "2026-11-20T11:00:00Z" },
        { name: "check_answer", props: { kind: "listen", right: true }, created_at: "2026-11-21T10:00:00Z" },
        { name: "check_answer", props: { kind: "listen", right: false }, created_at: "2026-11-21T10:01:00Z" },
        { name: "check_answer", props: { kind: "order", right: true }, created_at: "2026-11-21T10:02:00Z" },
        { name: "check_answer", props: { kind: "gap", right: false }, created_at: "2026-11-21T10:03:00Z" },
        { name: "check_answer", props: { kind: "translate", right: true }, created_at: "2026-11-21T10:04:00Z" },
        { name: "voice_reply", props: {}, created_at: "2026-11-22T09:00:00Z" },
      ],
      [
        { conversation_id: "a", correction: { category: "none" }, created_at: "2026-11-22T09:00:00Z" },
        { conversation_id: "a", correction: { category: "error" }, created_at: "2026-11-22T09:01:00Z" },
        { conversation_id: "b", correction: { category: "valid_variant" }, created_at: "2026-11-22T09:05:00Z" },
        { conversation_id: "b", correction: null, created_at: "2026-11-22T09:06:00Z" },
      ],
    );
    expect(s.speaking).toEqual({ attempts: 2, clear: 1 });
    expect(s.listening).toEqual({ right: 1, total: 2 });
    expect(s.building).toEqual({ right: 1, total: 2 });
    expect(s.translating).toEqual({ right: 1, total: 1 });
    expect(s.conversation).toEqual({ conversations: 2, replies: 4, correct: 2, spoken: 1 });
    expect(s.activeDays).toBe(3);
  });

  it("is all zeros with no practice", () => {
    const s = summarisePractice([], []);
    expect(s.activeDays).toBe(0);
    expect(s.conversation.replies).toBe(0);
  });
});
