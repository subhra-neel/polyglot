"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { gradeCard } from "@/app/(app)/review/actions";
import type { QueueCard } from "@/lib/progress";
import type { Answer } from "@/lib/srs";
import { type AudioUrls, SpeakButtons } from "./speak-buttons";

export type SessionCard = { card: QueueCard; previews: Record<Answer, string>; audio: AudioUrls | null };

const ANSWER_STYLE: Record<Answer, { label: string; hint: string }> = {
  again: { label: "Again", hint: "Couldn't recall" },
  hard: { label: "Hard", hint: "Got there slowly" },
  good: { label: "Good", hint: "Said it" },
  easy: { label: "Easy", hint: "Instant" },
};

type Props = { initial: SessionCard[]; showScript: boolean };

/**
 * One card at a time: the English meaning first, so the learner has to
 * produce the Kannada (say it aloud), then the answer with audio, then a
 * self-rating that FSRS uses to schedule the next review.
 */
export function ReviewSession({ initial, showScript }: Props) {
  const [queue, setQueue] = useState(initial);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = queue[0];

  if (!current) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-xl font-medium">All done for now</p>
        <p className="mt-2 text-muted">
          {done === 1 ? "1 review" : `${done} reviews`} finished. Sentences come back when you are about to forget them.
        </p>
        <Link
          href="/today"
          className="mt-6 flex h-12 items-center justify-center rounded-full bg-accent font-medium text-accent-ink"
        >
          Back to Today
        </Link>
      </div>
    );
  }

  const { card, previews } = current;
  const sentence = card.sentence;

  function answer(choice: Answer) {
    setError(null);
    startTransition(async () => {
      const result = await gradeCard(card.id, choice);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone((n) => n + 1);
      setRevealed(false);
      setQueue((rest) => {
        const remaining = rest.slice(1);
        return result.dueSoon
          ? [...remaining, { card: result.card, previews: result.previews, audio: current.audio }]
          : remaining;
      });
    });
  }

  return (
    <div>
      <p className="text-sm text-muted" aria-live="polite">
        {queue.length} left · {done} done
      </p>

      <article className="mt-3 rounded-2xl border border-line bg-surface p-6" aria-label="Review card">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Say it in Kannada</p>
        <p className="mt-2 text-2xl font-medium leading-snug tracking-tight">{sentence.meaning}</p>
        {sentence.formality !== "neutral" ? (
          <p className="mt-2 text-sm text-muted">
            {sentence.formality === "respectful" ? "Respectful" : "Casual"}
          </p>
        ) : null}

        {revealed ? (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-2xl font-medium tracking-tight" lang="kn-Latn">
              {sentence.roman}
            </p>
            {showScript && sentence.script ? (
              <p className="mt-1 text-lg text-muted" lang="kn">
                {sentence.script}
              </p>
            ) : null}
            <div className="mt-4">
              <SpeakButtons script={sentence.script} audio={current.audio} />
            </div>
            {sentence.why ? <p className="mt-4 text-sm leading-relaxed text-muted">{sentence.why}</p> : null}
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">Say it out loud first, then check.</p>
        )}
      </article>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-6">
        {revealed ? (
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="How well did you remember?">
            {(Object.keys(ANSWER_STYLE) as Answer[]).map((choice) => (
              <button
                key={choice}
                type="button"
                disabled={pending}
                onClick={() => answer(choice)}
                className={`flex flex-col items-center rounded-2xl border px-1 py-3 disabled:opacity-50 ${
                  choice === "good" ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
                }`}
              >
                <span className="font-medium">{ANSWER_STYLE[choice].label}</span>
                <span className={`text-xs ${choice === "good" ? "" : "text-muted"}`}>{previews[choice]}</span>
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="h-14 w-full rounded-full bg-accent text-lg font-medium text-accent-ink"
          >
            Show answer
          </button>
        )}
        {revealed ? (
          <p className="mt-3 text-center text-xs text-muted">
            {ANSWER_STYLE.again.hint} · {ANSWER_STYLE.hard.hint} · {ANSWER_STYLE.good.hint} · {ANSWER_STYLE.easy.hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
