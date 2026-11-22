"use client";

import { useEffect, useState } from "react";
import { logPractice } from "@/app/actions/practice";
import { type Question, typedMatches } from "@/lib/unit-check";
import { BottomBar, dangerButton, primaryButton } from "./bottom-bar";
import { playAudio, SpeakButtons } from "./speak-buttons";

export type ExerciseResult = { right: boolean; answer: string; sentenceId: string };

export const PROMPT: Record<Question["kind"], string> = {
  order: "Put the words in order",
  listen: "What did you hear?",
  gap: "Fill in the missing word",
  translate: "Say this in Kannada",
  pick: "Which is the Kannada?",
};

const optionClass = (selected: boolean, verdict: "right" | "wrong" | null) =>
  `w-full rounded-2xl border-2 bg-surface p-4 text-left text-lg shadow-[0_3px_0_0_var(--line)] ${
    verdict === "right"
      ? "border-accent bg-accent-soft"
      : verdict === "wrong"
        ? "border-danger bg-danger-soft"
        : selected
          ? "border-accent"
          : "border-line"
  }`;

/**
 * One question on its own screen. The learner answers, taps Check, sees the
 * verdict and the sentence's explanation in the bar at the bottom, then
 * taps Continue.
 */
export function Exercise({ q, onNext }: { q: Question; onNext: (r: ExerciseResult) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ExerciseResult | null>(null);

  // A listening question plays its sentence straight away.
  useEffect(() => {
    if (q.kind === "listen") void playAudio(q.audio.normal);
  }, [q]);

  const ready =
    q.kind === "order"
      ? picked.length === q.chips.length
      : q.kind === "listen" || q.kind === "pick"
        ? chosen !== null
        : text.trim().length > 0;

  function check() {
    if (!ready || result) return;
    let right = false;
    let answer = "";
    if (q.kind === "order") {
      right = picked.map((i) => q.chips[i]).join(" ") === q.answer.join(" ");
      answer = q.answer.join(" ");
    } else if (q.kind === "listen") {
      right = chosen === q.answer;
      answer = q.roman;
    } else if (q.kind === "pick") {
      right = chosen === q.answer;
      answer = q.answer;
    } else if (q.kind === "gap") {
      right = typedMatches(text, [q.answer]);
      answer = q.roman;
    } else {
      right = typedMatches(text, q.accepted);
      answer = q.answer;
    }
    const r = { right, answer, sentenceId: q.sentenceId };
    setResult(r);
    void logPractice("check_answer", { kind: q.kind, right });
  }

  const done = result !== null;

  return (
    <div className="pb-56">
      <h2 className="text-2xl font-semibold tracking-tight">{PROMPT[q.kind]}</h2>

      {q.kind === "order" ? (
        <div className="mt-5">
          <p className="text-lg text-muted">“{q.meaning}”</p>
          <p
            className="mt-4 min-h-16 border-b-2 border-line pb-3 text-2xl font-medium leading-snug"
            lang="kn-Latn"
            aria-label="Your sentence"
          >
            {picked.length ? picked.map((i) => q.chips[i]).join(" ") : <span className="text-base text-muted">Tap the words below</span>}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {q.chips.map((chip, i) => (
              <button
                key={i}
                type="button"
                disabled={picked.includes(i) || done}
                onClick={() => setPicked([...picked, i])}
                className="h-12 rounded-xl border-2 border-line bg-surface px-4 text-lg font-medium shadow-[0_3px_0_0_var(--line)] disabled:opacity-25"
              >
                {chip}
              </button>
            ))}
          </div>
          {picked.length && !done ? (
            <button type="button" onClick={() => setPicked(picked.slice(0, -1))} className="mt-4 text-sm font-medium text-muted">
              ⌫ Undo last word
            </button>
          ) : null}
        </div>
      ) : null}

      {q.kind === "listen" ? (
        <div className="mt-5">
          <SpeakButtons script={null} audio={q.audio} />
          <ul className="mt-5 space-y-3">
            {q.options.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => setChosen(o)}
                  className={optionClass(chosen === o, done ? (o === q.answer ? "right" : o === chosen ? "wrong" : null) : null)}
                >
                  {o}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {q.kind === "pick" ? (
        <div className="mt-5">
          <p className="text-lg text-muted">“{q.meaning}”</p>
          <ul className="mt-5 space-y-3">
            {q.options.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => setChosen(o)}
                  lang="kn-Latn"
                  className={optionClass(chosen === o, done ? (o === q.answer ? "right" : o === chosen ? "wrong" : null) : null)}
                >
                  {o}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {q.kind === "gap" || q.kind === "translate" ? (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <p className="text-lg text-muted">“{q.meaning}”</p>
          {q.kind === "gap" ? (
            <p className="mt-4 text-2xl font-medium" lang="kn-Latn">
              {q.before} <span className="rounded-lg bg-accent-soft px-3 text-accent">____</span> {q.after}
            </p>
          ) : null}
          {q.kind === "gap" && q.gloss ? <p className="mt-2 text-sm text-muted">Hint: {q.gloss}</p> : null}
          <label className="sr-only" htmlFor="typed">
            Your answer
          </label>
          <input
            id="typed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={done}
            autoComplete="off"
            autoCapitalize="off"
            placeholder={q.kind === "gap" ? "The missing word" : "Type it in English letters"}
            className="mt-5 h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 text-lg"
          />
          <p className="mt-2 text-sm text-muted">Spelling can be loose: beku = bēku.</p>
        </form>
      ) : null}

      {result ? (
        <BottomBar tone={result.right ? "right" : "wrong"}>
          <div role="status" className="mb-4">
            <p className={`text-xl font-semibold ${result.right ? "text-accent" : "text-danger"}`}>
              {result.right ? "✓ Nice!" : "Not quite"}
            </p>
            {!result.right || q.kind === "listen" ? (
              <p className="mt-1">
                <span className="text-muted">{result.right ? "You heard: " : "Answer: "}</span>
                <span className="font-semibold" lang="kn-Latn">
                  {result.answer}
                </span>
              </p>
            ) : null}
            {q.why ? <p className="mt-1 line-clamp-3 text-sm">{q.why}</p> : null}
          </div>
          <button type="button" autoFocus onClick={() => onNext(result)} className={result.right ? primaryButton : dangerButton}>
            Continue
          </button>
        </BottomBar>
      ) : (
        <BottomBar>
          <button type="button" disabled={!ready} onClick={check} className={primaryButton}>
            Check
          </button>
        </BottomBar>
      )}
    </div>
  );
}
