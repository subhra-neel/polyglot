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
  | { kind: "translate"; sentenceId: string; meaning: string; answer: string; accepted: string[]; why: string | null }
  | { kind: "pick"; sentenceId: string; meaning: string; options: string[]; answer: string; why: string | null };

export type QuestionKind = Question["kind"];

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

  const make = (kind: (typeof KINDS)[number], sentence: CheckSentence) => makeQuestion(kind, sentence, sentences, random);
  for (let round = 0; questions.length < count && round < count * 4; round++) {
    const kind = KINDS[round % KINDS.length];
    const sentence = pool.find((s) => !used.has(s.id) && make(kind, s) !== null);
    if (!sentence) continue;
    const q = make(kind, sentence);
    if (q) {
      used.add(sentence.id);
      questions.push(q);
    }
  }
  return questions;
}

/** The meaning without notes in brackets: "How are you? (to a friend)" → "how are you". */
const core = (meaning: string) =>
  meaning
    .replace(/\(.*?\)/g, "")
    .toLowerCase()
    .replace(/[^a-z' ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Two sentences that a learner could fairly give for the same English. */
export function sameSense(a: CheckSentence, b: CheckSentence): boolean {
  if (core(a.meaning) === core(b.meaning)) return true;
  const plainA = a.roman.replace(/[?!.,]/g, "");
  const plainB = b.roman.replace(/[?!.,]/g, "");
  return (
    plainA === plainB ||
    a.variants.some((v) => v.roman.replace(/[?!.,]/g, "") === plainB) ||
    b.variants.some((v) => v.roman.replace(/[?!.,]/g, "") === plainA)
  );
}

/**
 * One question of a given kind about one sentence, or null when that kind
 * doesn't suit it (too short to reorder, no audio, too few other sentences
 * for wrong options). `pool` supplies the wrong options.
 */
export function makeQuestion(kind: QuestionKind, s: CheckSentence, pool: CheckSentence[], random: Random): Question | null {
  // Wrong options must really be wrong: never another way of saying the same
  // thing ("How are you? (to a friend)" for "How are you?", or a listed alternative).
  const others = pool.filter((x) => x.id !== s.id && !sameSense(x, s));
  const meanings = [...new Set(others.map((x) => x.meaning))];
  const builders: Record<QuestionKind, (s: CheckSentence) => Question | null> = {
    order: (s) => {
      const w = words(s.roman);
      if (w.length < 3) return null;
      return { kind: "order", sentenceId: s.id, meaning: s.meaning, chips: jumble(w, random), answer: w, why: s.why };
    },
    listen: (s) => {
      if (!s.audio || meanings.length < 3) return null;
      const wrong = shuffle(meanings, random).slice(0, 3);
      return {
        kind: "listen",
        sentenceId: s.id,
        audio: s.audio,
        roman: s.roman,
        options: shuffle([s.meaning, ...wrong], random),
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
  
    pick: (s) => {
      const romans = [...new Set(others.map((x) => x.roman))];
      if (romans.length < 2) return null;
      const wrong = shuffle(romans, random).slice(0, 3);
      return { kind: "pick", sentenceId: s.id, meaning: s.meaning, options: shuffle([s.roman, ...wrong], random), answer: s.roman, why: s.why };
    },
  };
  return builders[kind](s);
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
