import { describe, expect, it } from "vitest";
import { buildSession } from "@/lib/lesson-session";
import { type CheckSentence, seeded } from "@/lib/unit-check";

const s = (id: string, roman: string, meaning: string, audio = true): CheckSentence => ({
  id,
  roman,
  meaning,
  why: null,
  tokens: [],
  variants: [],
  audio: audio ? { normal: `/a/${id}`, slow: `/a/${id}/slow` } : null,
});

const LESSON = [
  s("1", "namaskāra", "Hello"),
  s("2", "hēgiddīrā?", "How are you?"),
  s("3", "chennāgiddīni", "I'm fine"),
  s("4", "nīvu?", "And you?"),
  s("5", "ūTa āytā?", "Have you eaten?"),
  s("6", "matte sigōNa", "See you again"),
  s("7", "nāLe sigōNa", "See you tomorrow"),
];

describe("buildSession", () => {
  const steps = buildSession(LESSON, seeded(4));

  it("introduces every sentence once, in order", () => {
    const learn = steps.filter((x) => x.kind === "learn");
    expect(learn.map((x) => x.kind === "learn" && x.sentenceId)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  });

  it("asks a quick question after every two new sentences, only about sentences already met", () => {
    const seen = new Set<string>();
    let sinceQuestion = 0;
    for (const step of steps) {
      if (step.kind === "learn") {
        seen.add(step.sentenceId);
        sinceQuestion++;
      } else {
        expect(seen.has(step.question.sentenceId)).toBe(true);
        sinceQuestion = 0;
      }
      expect(sinceQuestion).toBeLessThanOrEqual(2);
    }
  });

  it("ends with a closing round of two questions", () => {
    expect(steps.at(-1)?.kind).toBe("exercise");
    expect(steps.at(-2)?.kind).toBe("exercise");
  });

  it("uses recognising questions early and producing ones at the end", () => {
    const first = steps.find((x) => x.kind === "exercise");
    expect(first?.kind === "exercise" && ["pick", "listen", "order"].includes(first.question.kind)).toBe(true);
    const kinds = steps.flatMap((x) => (x.kind === "exercise" ? [x.question.kind] : []));
    expect(kinds).toContain("translate");
  });

  it("still works for a two-sentence lesson without audio", () => {
    const short = buildSession([s("a", "sari", "Okay", false), s("b", "bēDa", "No thanks", false)], seeded(1));
    expect(short.filter((x) => x.kind === "learn")).toHaveLength(2);
    expect(short.every((x) => x.kind === "learn" || x.question.kind !== "listen")).toBe(true);
  });
});

describe("wrong options", () => {
  it("never offer another way of saying the same thing", async () => {
    const { makeQuestion } = await import("@/lib/unit-check");
    const pool = [
      s("r", "hēgiddīrā?", "How are you?"),
      { ...s("c", "hēgiddīyā?", "How are you? (to a friend)"), variants: [] },
      s("f", "chennāgiddīni", "I'm fine"),
      s("n", "nīvu?", "And you?"),
      s("h", "namaskāra", "Hello"),
    ];
    for (let seed = 1; seed < 30; seed++) {
      const pick = makeQuestion("pick", pool[0], pool, seeded(seed));
      expect(pick?.kind === "pick" && pick.options).not.toContain("hēgiddīyā?");
      const listen = makeQuestion("listen", pool[0], pool, seeded(seed));
      expect(listen?.kind === "listen" && listen.options).not.toContain("How are you? (to a friend)");
    }
  });
});
