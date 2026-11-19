import { describe, expect, it } from "vitest";
import { buildCheck, type CheckSentence, seeded, typedMatches } from "@/lib/unit-check";

const s = (id: string, roman: string, meaning: string, audio = true): CheckSentence => ({
  id,
  roman,
  meaning,
  why: `why ${id}`,
  tokens: roman.replace(/[?,]/g, "").split(" ").map((w) => ({ word: w, gloss: `gloss of ${w}` })),
  variants: [],
  audio: audio ? { normal: `/a/${id}/normal`, slow: `/a/${id}/slow` } : null,
});

const UNIT = [
  s("1", "nanage nīru bēku", "I want water"),
  s("2", "nanage help bēku", "I need help"),
  s("3", "nimage ēnu bēku?", "What would you like?"),
  s("4", "nanage Tī bēku", "I'd like tea"),
  s("5", "bēkā?", "Do you want it?"),
  s("6", "bēDa", "No thanks"),
  s("7", "plāsTik byāg bēDa", "No plastic bag"),
  s("8", "nanage ūTa bēDa", "I don't want a meal"),
];

describe("buildCheck", () => {
  it("mixes the four kinds, uses each sentence once, and is repeatable with a seed", () => {
    const a = buildCheck(UNIT, seeded(7));
    const b = buildCheck(UNIT, seeded(7));
    expect(a).toEqual(b);
    expect(new Set(a.map((q) => q.kind))).toEqual(new Set(["order", "listen", "gap", "translate"]));
    expect(new Set(a.map((q) => q.sentenceId)).size).toBe(a.length);
    expect(a.length).toBeGreaterThanOrEqual(6);
  });

  it("jumbles word-order chips and keeps the right answer", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const q of buildCheck(UNIT, seeded(seed))) {
        if (q.kind !== "order") continue;
        expect([...q.chips].sort()).toEqual([...q.answer].sort());
        expect(q.chips.join(" ")).not.toBe(q.answer.join(" "));
      }
    }
  });

  it("gives listening questions four different meanings including the right one", () => {
    const q = buildCheck(UNIT, seeded(3)).find((x) => x.kind === "listen");
    expect(q && q.kind === "listen" && q.options.length).toBe(4);
    if (q?.kind === "listen") {
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(4);
    }
  });

  it("blanks the longest word in a gap question", () => {
    const q = buildCheck([s("1", "nanage nīru bēku", "I want water")], seeded(1), 1);
    // Only one sentence: the first kind (order) uses it.
    expect(q[0].kind).toBe("order");
    const gaps = buildCheck(UNIT, seeded(9)).filter((x) => x.kind === "gap");
    for (const g of gaps) if (g.kind === "gap") expect(g.answer.length).toBeGreaterThanOrEqual(3);
  });

  it("skips listening when there is no audio", () => {
    const qs = buildCheck(UNIT.map((x) => ({ ...x, audio: null })), seeded(2));
    expect(qs.some((q) => q.kind === "listen")).toBe(false);
  });
});

describe("typedMatches", () => {
  it("accepts loose spelling of every word", () => {
    expect(typedMatches("nanage neeru beku", ["nanage nīru bēku"])).toBe(true);
    expect(typedMatches("Nanage Neeru Beku?", ["nanage nīru bēku"])).toBe(true);
  });
  it("rejects a wrong word, a missing word or an extra word", () => {
    expect(typedMatches("naanu neeru beku", ["nanage nīru bēku"])).toBe(false);
    expect(typedMatches("nanage beku", ["nanage nīru bēku"])).toBe(false);
    expect(typedMatches("nanage nīru bēku bēku", ["nanage nīru bēku"])).toBe(false);
    expect(typedMatches("", ["nanage nīru bēku"])).toBe(false);
  });
  it("accepts an alternative way of saying it", () => {
    expect(typedMatches("hegidiri", ["hēgiddīrā?", "hēgiddīri?"])).toBe(true);
  });
});
