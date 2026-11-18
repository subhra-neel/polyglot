/**
 * Compares what speech recognition heard with the sentence the learner was
 * trying to say, word by word. This is a rough guide (did the recogniser
 * understand each word?), not a pronunciation score: the app says so.
 */

/** English-letter Kannada reduced to sounds a recogniser reliably separates. */
export function soundKey(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // ā → a
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "f")
    .replace(/([kgcjtdb])h/g, "$1") // aspirates: dh → d
    .replace(/w/g, "v")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/([a-z])\1+/g, "$1"); // doubled letters
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/**
 * Close enough to count as the same word: about one sound in four may differ
 * in longer words; short words (alla / illa, bēku / bēDa) must match exactly.
 */
export function sameWord(target: string, heard: string): boolean {
  const a = soundKey(target);
  const b = soundKey(heard);
  if (!a || !b) return false;
  if (a === b) return true;
  const longest = Math.max(a.length, b.length);
  return longest > 4 && distance(a, b) <= Math.floor(longest / 4);
}

export type SpokenWord = { word: string; heard: boolean };
export type SpokenResult = { words: SpokenWord[]; matched: number; verdict: "clear" | "nearly" | "again" };

const words = (s: string) => s.split(/\s+/).map((w) => w.replace(/[?!.,]/g, "")).filter(Boolean);

/** Marks each target word as heard or not, matching in order (a word heard out of place still counts). */
export function compareSpoken(targetRoman: string, heardRoman: string): SpokenResult {
  const target = words(targetRoman);
  const heard = words(heardRoman);
  const used = new Set<number>();
  const result = target.map((word) => {
    const i = heard.findIndex((h, k) => !used.has(k) && sameWord(word, h));
    if (i >= 0) used.add(i);
    return { word, heard: i >= 0 };
  });
  const matched = result.filter((w) => w.heard).length;
  const verdict = matched === target.length ? "clear" : matched * 2 >= target.length ? "nearly" : "again";
  return { words: result, matched, verdict };
}
