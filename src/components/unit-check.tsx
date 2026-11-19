"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { saveUnitCheck } from "@/app/(app)/learn/[unit]/check/actions";
import { type Question, typedMatches } from "@/lib/unit-check";
import { SpeakButtons } from "./speak-buttons";

const PROMPT: Record<Question["kind"], string> = {
  order: "Put the words in order",
  listen: "Listen. What does it mean?",
  gap: "Fill in the missing word",
  translate: "Say it in Kannada",
};

type Result = { right: boolean; answer: string; sentenceId?: string };

function Explain({ result, why, extra }: { result: Result; why: string | null; extra?: string }) {
  return (
    <div className={`mt-4 rounded-xl p-4 leading-relaxed ${result.right ? "bg-accent-soft" : "border border-danger/40"}`} role="status">
      <p className={`font-medium ${result.right ? "text-accent" : "text-danger"}`}>{result.right ? "✓ Right" : "Not quite"}</p>
      <p className="mt-1">
        <span className="text-muted">Answer: </span>
        <span className="font-medium" lang="kn-Latn">
          {result.answer}
        </span>
      </p>
      {extra ? <p className="mt-1 text-sm text-muted">{extra}</p> : null}
      {why ? <p className="mt-2 text-sm">{why}</p> : null}
    </div>
  );
}

function Order({ q, onDone }: { q: Extract<Question, { kind: "order" }>; onDone: (r: Result) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const built = picked.map((i) => q.chips[i]);
  return (
    <div>
      <p className="text-muted">“{q.meaning}”</p>
      <p className="mt-3 min-h-12 rounded-xl border border-line bg-surface p-3 text-lg font-medium" lang="kn-Latn" aria-label="Your sentence">
        {built.join(" ") || <span className="text-muted">Tap the words below</span>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {q.chips.map((chip, i) => (
          <button
            key={i}
            type="button"
            disabled={picked.includes(i) || result !== null}
            onClick={() => setPicked([...picked, i])}
            className="h-11 rounded-full border border-line bg-surface px-4 font-medium disabled:opacity-30"
          >
            {chip}
          </button>
        ))}
      </div>
      {result ? (
        <Explain result={result} why={q.why} />
      ) : (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setPicked([])} className="h-11 px-3 text-sm font-medium text-muted">
            Clear
          </button>
          <button
            type="button"
            disabled={picked.length !== q.chips.length}
            onClick={() => {
              const r = { right: built.join(" ") === q.answer.join(" "), answer: q.answer.join(" ") };
              setResult(r);
              onDone(r);
            }}
            className="h-11 flex-1 rounded-full bg-accent font-medium text-accent-ink disabled:opacity-50"
          >
            Check
          </button>
        </div>
      )}
    </div>
  );
}

function Listen({ q, onDone }: { q: Extract<Question, { kind: "listen" }>; onDone: (r: Result) => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <div>
      <SpeakButtons script={null} audio={q.audio} />
      <ul className="mt-4 space-y-2">
        {q.options.map((o) => {
          const state = chosen === null ? "" : o === q.answer ? "border-accent bg-accent-soft" : o === chosen ? "border-danger" : "opacity-50";
          return (
            <li key={o}>
              <button
                type="button"
                disabled={chosen !== null}
                onClick={() => {
                  setChosen(o);
                  onDone({ right: o === q.answer, answer: q.roman });
                }}
                className={`w-full rounded-xl border border-line bg-surface p-4 text-left ${state}`}
              >
                {o}
              </button>
            </li>
          );
        })}
      </ul>
      {chosen !== null ? <Explain result={{ right: chosen === q.answer, answer: q.roman }} why={q.why} extra={`It means: ${q.answer}`} /> : null}
    </div>
  );
}

function Typed({
  q,
  onDone,
}: {
  q: Extract<Question, { kind: "gap" }> | Extract<Question, { kind: "translate" }>;
  onDone: (r: Result) => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const isGap = q.kind === "gap";
  function check(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || result) return;
    const r = isGap
      ? { right: typedMatches(text, [q.answer]), answer: q.roman }
      : { right: typedMatches(text, q.accepted), answer: q.answer };
    setResult(r);
    onDone(r);
  }
  return (
    <form onSubmit={check}>
      <p className="text-muted">“{q.meaning}”</p>
      {isGap ? (
        <p className="mt-3 text-lg font-medium" lang="kn-Latn">
          {q.before} <span className="rounded bg-accent-soft px-2 text-accent">____</span> {q.after}
        </p>
      ) : null}
      {isGap && q.gloss ? <p className="mt-1 text-sm text-muted">Hint: {q.gloss}</p> : null}
      <label className="sr-only" htmlFor="typed">
        Your answer
      </label>
      <input
        id="typed"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={result !== null}
        autoComplete="off"
        autoCapitalize="off"
        placeholder={isGap ? "The missing word" : "Type it in Kannada"}
        className="mt-3 h-12 w-full rounded-full border border-line bg-surface px-4 text-base"
      />
      {result ? (
        <Explain result={result} why={q.why} />
      ) : (
        <button type="submit" disabled={!text.trim()} className="mt-3 h-12 w-full rounded-full bg-accent font-medium text-accent-ink disabled:opacity-50">
          Check
        </button>
      )}
    </form>
  );
}

export function UnitCheck({ questions, unitSlug }: { questions: Question[]; unitSlug: string }) {
  const router = useRouter();
  const unitHref = `/learn/${unitSlug}`;
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<{ id: string; roman: string }[]>([]);
  const [saved, setSaved] = useState<{ backToRevision: number } | "failed" | null>(null);
  const finished = questions.length > 0 && index >= questions.length;

  // Save once, when the last question is done.
  useEffect(() => {
    if (!finished || saved !== null) return;
    let live = true;
    saveUnitCheck(unitSlug, score, questions.length, missed.map((m) => m.id)).then((r) => {
      if (live) setSaved(r.ok ? { backToRevision: r.backToRevision } : "failed");
    });
    return () => {
      live = false;
    };
  }, [finished, saved, unitSlug, score, questions.length, missed]);

  if (questions.length === 0) return <p className="text-muted">This unit doesn&apos;t have enough sentences for a check yet.</p>;

  if (index >= questions.length) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <section className="rounded-2xl border border-line bg-surface p-5" aria-label="Result">
        <p className="text-3xl font-semibold tracking-tight">
          {score} of {questions.length}
        </p>
        <p className="mt-2 text-muted">
          {pct >= 80
            ? "Strong. You can build these sentences yourself."
            : pct >= 50
              ? "Getting there. Go over the ones you missed, then try again."
              : "Worth another pass through the lessons first."}
        </p>
        {missed.length ? (
          <>
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted">To practise</p>
            <ul className="mt-2 space-y-1">
              {missed.map((m) => (
                <li key={m.id} className="font-medium" lang="kn-Latn">
                  {m.roman}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="mt-4 text-sm text-muted" role="status">
          {saved === null
            ? "Saving…"
            : saved === "failed"
              ? "Couldn't save this result. Your answers still count for practice."
              : saved.backToRevision > 0
                ? `Saved. ${saved.backToRevision} missed ${saved.backToRevision === 1 ? "sentence is" : "sentences are"} back in your revision for today.`
                : "Saved."}
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setScore(0);
            setMissed([]);
            setSaved(null);
            setAnswered(false);
            router.refresh();
          }}
          className="mt-5 h-12 w-full rounded-full bg-accent font-medium text-accent-ink"
        >
          New check
        </button>
        <Link href={unitHref} className="mt-2 flex h-12 items-center justify-center font-medium text-accent">
          Back to the unit
        </Link>
      </section>
    );
  }

  const q = questions[index];
  const onDone = (r: Result) => {
    setAnswered(true);
    if (r.right) setScore((s) => s + 1);
    else setMissed((m) => [...m, { id: q.sentenceId, roman: r.answer }]);
  };

  return (
    <section aria-label={`Question ${index + 1} of ${questions.length}`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted">
        {index + 1} of {questions.length} · {PROMPT[q.kind]}
      </p>
      <div className="mt-3" key={index}>
        {q.kind === "order" ? <Order q={q} onDone={onDone} /> : null}
        {q.kind === "listen" ? <Listen q={q} onDone={onDone} /> : null}
        {q.kind === "gap" || q.kind === "translate" ? <Typed q={q} onDone={onDone} /> : null}
      </div>
      {answered ? (
        <button
          type="button"
          onClick={() => {
            setAnswered(false);
            setIndex(index + 1);
          }}
          className="mt-4 h-12 w-full rounded-full bg-accent font-medium text-accent-ink"
        >
          {index + 1 === questions.length ? "See result" : "Next"}
        </button>
      ) : null}
    </section>
  );
}
