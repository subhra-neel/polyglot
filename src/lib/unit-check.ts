import { compareSpoken, soundKey } from "./speech-match";

/**
 * A short end-of-unit check built from the unit's own sentences, so it needs
 * no extra content: put words in order, pick what you heard, fill the gap,
 * and say an English sentence in Kannada. Each question carries the
 * sentence's own explanation to show after answering.
 */

export type CheckSentence = {
  id: string;
  roman: string;
  meaning: string;
  why: string | null;
  tokens: { word: string; gloss: string }[];
  variants: { roman: string }[];
  audio: { normal: string; slow: string } | null;
};

export type Question =
  | { kind: "order"; sentenceId: string; meaning: string; chips: string[]; answer: string[]; why: string | null }
  | { kind: "listen"; sentenceId: string; audio: { normal: string; slow: string }; roman: string; options: string[]; answer: string; why: string | null }
  | { kind: "gap"; sentenceId: string; meaning: string; before: string; after: string; answer: string; gloss: string; roman: string; why: string | null }
  | { kind: "translate"; sentenceId: string; meaning: string; answer: string; accepted: string[]; why: string | null };

export type Random = () => number;

/** Small seeded random number generator, so a check can be rebuilt exactly in tests. */
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const plain = (s: string) => s.replace(/[?!.,]/g, "").trim();
const words = (s: string) => plain(s).split(/\s+/).filter(Boolean);

/** A shuffle that differs from the original order (when that is possible). */
function jumble(list: string[], random: Random): string[] {
  for (let tries = 0; tries < 6; tries++) {
    const s = shuffle(list, random);
    if (s.join(" ") !== list.join(" ")) return s;
  }
  return [...list].reverse();
}

const KINDS = ["order", "listen", "gap", "translate"] as const;

/** Builds up to `count` questions, cycling through the four kinds and never reusing a sentence. */
export function buildCheck(sentences: CheckSentence[], random: Random, count = 8): Question[] {
  const pool = shuffle(sentences, random);
  const used = new Set<string>();
  const questions: Question[] = [];
  const meanings = [...new Set(sentences.map((s) => s.meaning))];

  const make: Record<(typeof KINDS)[number], (s: CheckSentence) => Question | null> = {
    order: (s) => {
      const w = words(s.roman);
      if (w.length < 3) return null;
      return { kind: "order", sentenceId: s.id, meaning: s.meaning, chips: jumble(w, random), answer: w, why: s.why };
    },
    listen: (s) => {
      if (!s.audio || meanings.length < 4) return null;
      const others = shuffle(meanings.filter((m) => m !== s.meaning), random).slice(0, 3);
      return {
        kind: "listen",
        sentenceId: s.id,
        audio: s.audio,
        roman: s.roman,
        options: shuffle([s.meaning, ...others], random),
        answer: s.meaning,
        why: s.why,
      };
    },
    gap: (s) => {
      const w = words(s.roman);
      if (w.length < 2) return null;
      // Blank the longest word: usually the one that carries the grammar.
      let index = 0;
      w.forEach((x, i) => {
        if (soundKey(x).length > soundKey(w[index]).length) index = i;
      });
      const gloss = s.tokens.find((t) => plain(t.word) === w[index])?.gloss ?? "";
      return {
        kind: "gap",
        sentenceId: s.id,
        meaning: s.meaning,
        before: w.slice(0, index).join(" "),
        after: w.slice(index + 1).join(" "),
        answer: w[index],
        gloss,
        roman: s.roman,
        why: s.why,
      };
    },
    translate: (s) => {
      if (words(s.roman).length < 2) return null;
      return {
        kind: "translate",
        sentenceId: s.id,
        meaning: s.meaning,
        answer: s.roman,
        accepted: [s.roman, ...s.variants.map((v) => v.roman)],
        why: s.why,
      };
    },
  };

  for (let round = 0; questions.length < count && round < count * 4; round++) {
    const kind = KINDS[round % KINDS.length];
    const sentence = pool.find((s) => !used.has(s.id) && make[kind](s) !== null);
    if (!sentence) continue;
    const q = make[kind](sentence);
    if (q) {
      used.add(sentence.id);
      questions.push(q);
    }
  }
  return questions;
}

/** Typed Kannada counts as right when every word matches (loose spelling allowed). */
export function typedMatches(typed: string, accepted: string[]): boolean {
  if (!typed.trim()) return false;
  return accepted.some((target) => {
    const r = compareSpoken(target, typed);
    return r.verdict === "clear" && words(typed).length === words(target).length;
  });
}

/** A new seed per visit, so each check is a fresh mix. */
export function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
