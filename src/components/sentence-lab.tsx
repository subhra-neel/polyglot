"use client";

import { useMemo, useState } from "react";
import type { Pattern, Word } from "@/lib/patterns";
import { type AudioUrls, SpeakButtons } from "./speak-buttons";

export type LabSentence = { roman: string; script: string; english: string; audio: AudioUrls | null };

type Props = {
  pattern: Pattern;
  words: Word[];
  /** Every buildable sentence, keyed "word|ending". */
  sentences: Record<string, LabSentence>;
  showScript: boolean;
};

const key = (word: string, ending: string) => `${word}|${ending}`;

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 py-2 text-base font-medium ${
        selected ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Build a sentence from a pattern by choosing the word and the ending, see
 * and hear the result, then practise: an English sentence appears and the
 * learner builds its Kannada.
 */
export function SentenceLab({ pattern, words, sentences, showScript }: Props) {
  const wordById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const [word, setWord] = useState(pattern.words[0].word);
  const [ending, setEnding] = useState(pattern.endings[0].id);
  const [target, setTarget] = useState<{ word: string; ending: string } | null>(null);
  const [verdict, setVerdict] = useState<{ right: boolean; text: string } | null>(null);
  const [score, setScore] = useState({ right: 0, tried: 0 });

  const built = sentences[key(word, ending)];
  const targetSentence = target ? sentences[key(target.word, target.ending)] : null;
  const endingOf = (id: string) => pattern.endings.find((e) => e.id === id)!;
  const englishOf = (id: string) => pattern.words.find((w) => w.word === id)!.english;

  function newTarget() {
    const combos = pattern.words.flatMap((w) => pattern.endings.map((e) => ({ word: w.word, ending: e.id })));
    const options = combos.filter((c) => !target || c.word !== target.word || c.ending !== target.ending);
    setTarget(options[Math.floor(Math.random() * options.length)]);
    setVerdict(null);
  }

  function check() {
    if (!target || !targetSentence) return;
    const wordRight = word === target.word;
    const endingRight = ending === target.ending;
    const right = wordRight && endingRight;
    const reasons: string[] = [];
    if (!wordRight) reasons.push(`"${englishOf(target.word)}" is ${wordById.get(target.word)!.roman}.`);
    if (!endingRight) {
      const want = endingOf(target.ending);
      reasons.push(`For "${want.label.toLowerCase()}", end with ${want.roman}.`);
    }
    setVerdict({
      right,
      text: right
        ? `Right: ${targetSentence.roman}`
        : `Not quite. You built "${built.english}". ${reasons.join(" ")} The answer is ${targetSentence.roman}.`,
    });
    setScore((s) => ({ right: s.right + (right ? 1 : 0), tried: s.tried + 1 }));
  }

  return (
    <div className="space-y-6">
      <section aria-label="Build a sentence" className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Choose a word</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {pattern.words.map((slot) => (
            <Chip key={slot.word} selected={word === slot.word} onClick={() => { setWord(slot.word); setVerdict(null); }}>
              {wordById.get(slot.word)!.roman}
              <span className={`ml-1.5 text-sm font-normal ${word === slot.word ? "" : "text-muted"}`}>{slot.english}</span>
            </Chip>
          ))}
        </div>

        {pattern.endings.length > 1 ? (
          <>
            <h2 className="mt-5 text-xs font-medium uppercase tracking-wider text-muted">Choose an ending</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {pattern.endings.map((e) => (
                <Chip key={e.id} selected={ending === e.id} onClick={() => { setEnding(e.id); setVerdict(null); }}>
                  {e.roman}
                  <span className={`ml-1.5 text-sm font-normal ${ending === e.id ? "" : "text-muted"}`}>{e.label}</span>
                </Chip>
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-6 border-t border-line pt-5" aria-live="polite">
          <p className="text-2xl font-medium tracking-tight" lang="kn-Latn">
            {built.roman}
          </p>
          {showScript ? (
            <p className="mt-0.5 text-lg text-muted" lang="kn">
              {built.script}
            </p>
          ) : null}
          <p className="mt-1 text-muted">{built.english}</p>
          <div className="mt-4">
            <SpeakButtons script={built.script} audio={built.audio} />
          </div>
        </div>
      </section>

      <section aria-label="Practise" className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Your turn</h2>
          {score.tried > 0 ? (
            <span className="text-sm text-muted">
              {score.right} / {score.tried} right
            </span>
          ) : null}
        </div>
        {targetSentence ? (
          <>
            <p className="mt-2 leading-relaxed">Build this in Kannada with the choices above:</p>
            <p className="mt-2 text-xl font-medium tracking-tight">{targetSentence.english}</p>
            {verdict ? (
              <p role="status" className={`mt-3 leading-relaxed ${verdict.right ? "text-accent" : "text-danger"}`}>
                {verdict.text}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              {verdict ? (
                <button type="button" onClick={newTarget} className="h-12 flex-1 rounded-full bg-accent font-medium text-accent-ink">
                  Next
                </button>
              ) : (
                <button type="button" onClick={check} className="h-12 flex-1 rounded-full bg-accent font-medium text-accent-ink">
                  Check
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 leading-relaxed text-muted">
              Get an English sentence and build it yourself. Say it aloud as you go.
            </p>
            <button type="button" onClick={newTarget} className="mt-4 h-12 w-full rounded-full bg-accent font-medium text-accent-ink">
              Start practising
            </button>
          </>
        )}
      </section>

      <details className="rounded-2xl border border-line bg-surface p-5">
        <summary className="cursor-pointer font-medium">Why it&apos;s built this way</summary>
        <p className="mt-3 leading-relaxed">{pattern.explanation}</p>
        {pattern.note ? <p className="mt-2 text-sm leading-relaxed text-muted">{pattern.note}</p> : null}
        <p className="mt-3 text-sm text-muted">
          Checked against published sources ({pattern.sources.join(", ")}). Not yet confirmed by a native speaker.
        </p>
      </details>
    </div>
  );
}
