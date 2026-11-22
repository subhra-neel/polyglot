import { type CheckSentence, makeQuestion, type Question, type QuestionKind, type Random, shuffle } from "./unit-check";

/**
 * A lesson as a sequence of small steps, one per screen: meet a new
 * sentence, then after every two new sentences answer a quick question
 * about one of them, and finish with a short round on the whole lesson.
 * Questions are only about sentences already met.
 */
export type Step =
  | { kind: "learn"; sentenceId: string; number: number; of: number }
  | { kind: "exercise"; question: Question };

/** Easier kinds first: recognising comes before producing. */
const QUICK: QuestionKind[] = ["pick", "listen", "order"];
const FINAL: QuestionKind[] = ["translate", "order", "gap", "listen", "pick"];

function firstThatFits(kinds: QuestionKind[], targets: CheckSentence[], pool: CheckSentence[], random: Random) {
  for (const kind of kinds) {
    for (const s of targets) {
      const q = makeQuestion(kind, s, pool, random);
      if (q) return q;
    }
  }
  return null;
}

export function buildSession(sentences: CheckSentence[], random: Random): Step[] {
  const steps: Step[] = [];
  const met: CheckSentence[] = [];
  let turn = 0;
  sentences.forEach((s, i) => {
    met.push(s);
    steps.push({ kind: "learn", sentenceId: s.id, number: i + 1, of: sentences.length });
    const pairDone = met.length % 2 === 0 || i === sentences.length - 1;
    if (!pairDone || met.length < 2) return;
    // Ask about one of the two newest sentences. Wrong options may come from the
    // whole lesson: recognising the right one among them still only needs what was met.
    const recent = shuffle(met.slice(-2), random);
    const kinds = [...QUICK.slice(turn % QUICK.length), ...QUICK.slice(0, turn % QUICK.length)];
    const q = firstThatFits(kinds, recent, sentences, random);
    if (q) {
      steps.push({ kind: "exercise", question: q });
      turn++;
    }
  });

  // Closing round: two questions on the whole lesson, preferring producing the sentence.
  const asked = new Set(steps.flatMap((s) => (s.kind === "exercise" ? [`${s.question.kind}:${s.question.sentenceId}`] : [])));
  let added = 0;
  for (const kind of FINAL) {
    if (added === 2) break;
    for (const s of shuffle(met, random)) {
      if (asked.has(`${kind}:${s.id}`)) continue;
      const q = makeQuestion(kind, s, sentences, random);
      if (q) {
        steps.push({ kind: "exercise", question: q });
        asked.add(`${kind}:${s.id}`);
        added++;
        break;
      }
    }
  }
  return steps;
}
