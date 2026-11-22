"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { saveUnitCheck } from "@/app/(app)/learn/[unit]/check/actions";
import type { Question } from "@/lib/unit-check";
import { BottomBar, primaryButton } from "./bottom-bar";
import { Exercise, type ExerciseResult } from "./exercise";

/** A unit check: questions one per screen, then a score that is saved. */
export function UnitCheck({ questions, unitSlug, unitTitle }: { questions: Question[]; unitSlug: string; unitTitle: string }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
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

  const progress = Math.round((Math.min(index, questions.length) / questions.length) * 100);
  const header = (
    <div className="flex items-center gap-4">
      <Link href="/learn" aria-label="Leave the check" className="text-2xl leading-none text-muted">
        ✕
      </Link>
      <div
        className="h-4 flex-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label="Check progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <>
        {header}
        <section className="mt-8 pb-56 text-center" aria-label="Result">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Unit check · {unitTitle}</p>
          <p className="mt-4 text-6xl font-semibold tracking-tight">
            {score} of {questions.length}
          </p>
          <p className="mt-3 text-lg text-muted">
            {pct >= 80
              ? "Strong. You can build these sentences yourself."
              : pct >= 50
                ? "Getting there. Go over the ones you missed, then try again."
                : "Worth another pass through the lessons first."}
          </p>
          {missed.length ? (
            <div className="mt-8 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">To practise</p>
              <ul className="mt-2 space-y-2">
                {missed.map((m) => (
                  <li key={m.id} className="rounded-xl border-2 border-line p-3 font-medium" lang="kn-Latn">
                    {m.roman}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-6 text-sm text-muted" role="status">
            {saved === null
              ? "Saving…"
              : saved === "failed"
                ? "Couldn't save this result. Your answers still count for practice."
                : saved.backToRevision > 0
                  ? `Saved. ${saved.backToRevision} missed ${saved.backToRevision === 1 ? "sentence is" : "sentences are"} back in your revision for today.`
                  : "Saved."}
          </p>
          <BottomBar>
            <Link href="/learn" className={primaryButton}>
              Back to the path
            </Link>
            <button
              type="button"
              onClick={() => {
                setIndex(0);
                setScore(0);
                setMissed([]);
                setSaved(null);
                router.refresh();
              }}
              className="mt-3 block w-full text-center font-medium text-muted"
            >
              New check
            </button>
          </BottomBar>
        </section>
      </>
    );
  }

  const onNext = (r: ExerciseResult) => {
    if (r.right) setScore((s) => s + 1);
    else setMissed((m) => [...m, { id: r.sentenceId, roman: r.answer }]);
    setIndex((i) => i + 1);
  };

  return (
    <>
      {header}
      <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-accent">
        Unit check · {index + 1} of {questions.length}
      </p>
      <div className="mt-2">
        <Exercise key={index} q={questions[index]} onNext={onNext} />
      </div>
    </>
  );
}
