"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { finishLesson } from "@/app/(app)/learn/actions";
import type { Sentence } from "@/lib/lessons";
import type { Step } from "@/lib/lesson-session";
import { BottomBar, primaryButton } from "./bottom-bar";
import { Exercise, type ExerciseResult } from "./exercise";
import { SayIt } from "./say-it";
import { Chip, FlagForm, RELATION_LABEL, Section } from "./sentence-card";
import { type AudioUrls, playAudio, SpeakButtons } from "./speak-buttons";

export type SessionSentence = Sentence & { audio: AudioUrls | null };

type Props = {
  unitSlug: string;
  lessonSlug: string;
  unitTitle: string;
  lessonTitle: string;
  lessonPosition: number;
  lessonCount: number;
  next: { slug: string; title: string } | null;
  sentences: SessionSentence[];
  steps: Step[];
  showEnglish: boolean;
  showScript: boolean;
};

function NewSentence({ s, number, of, showEnglish, showScript }: { s: SessionSentence; number: number; of: number; showEnglish: boolean; showScript: boolean }) {
  const [meaningShown, setMeaningShown] = useState(showEnglish);
  const [flagging, setFlagging] = useState(false);
  return (
    <article aria-label={`New sentence ${number} of ${of}`} className="pb-40">
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">
        New sentence · {number} of {of}
      </p>
      <p className="mt-4 text-4xl font-semibold leading-tight tracking-tight" lang="kn-Latn">
        {s.roman}
      </p>
      {showScript && s.script ? (
        <p className="mt-1 text-xl text-muted" lang="kn">
          {s.script}
        </p>
      ) : null}
      {meaningShown ? (
        <p className="mt-2 text-xl text-muted">{s.meaning}</p>
      ) : (
        <button type="button" onClick={() => setMeaningShown(true)} className="mt-2 font-medium text-accent">
          Show meaning
        </button>
      )}
      {s.formality !== "neutral" || s.register === "colloquial" || s.region ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.formality !== "neutral" ? <Chip>{s.formality === "respectful" ? "Respectful" : "Casual"}</Chip> : null}
          {s.register === "colloquial" ? <Chip>Spoken</Chip> : null}
          {s.region ? <Chip>{s.region}</Chip> : null}
        </div>
      ) : null}

      <div className="mt-5">
        <SpeakButtons script={s.script} audio={s.audio} />
      </div>

      {s.tokens.length ? (
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Word by word">
          {s.tokens.map((t, i) => (
            <li key={i} className="rounded-xl border-2 border-line bg-surface px-3 py-2">
              <span className="block font-semibold" lang="kn-Latn">
                {t.word}
              </span>
              <span className="block text-sm text-muted">{t.gloss}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {s.why ? (
        <div className="mt-6 rounded-2xl bg-accent-soft p-4 leading-relaxed">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">How it works</p>
          <p className="mt-1">{s.why}</p>
        </div>
      ) : null}

      <details className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-medium">More: pronunciation, other ways to say it</summary>
        <div className="mt-4 space-y-4">
          {s.tokens.some((t) => t.breakdown) ? (
            <Section title="How the words are built">
              <ul className="space-y-1">
                {s.tokens
                  .filter((t) => t.breakdown)
                  .map((t, i) => (
                    <li key={i}>
                      <span className="font-medium">{t.word}</span> <span className="text-muted">= {t.breakdown}</span>
                    </li>
                  ))}
              </ul>
            </Section>
          ) : null}
          {s.pronunciation ? (
            <Section title="Pronunciation">
              <p>{s.pronunciation}</p>
            </Section>
          ) : null}
          {s.variants.length ? (
            <Section title="Other ways to say it">
              <ul className="space-y-2">
                {s.variants.map((v, i) => (
                  <li key={i}>
                    <Chip>{RELATION_LABEL[v.relation] ?? v.relation}</Chip>{" "}
                    <span className="font-medium" lang="kn-Latn">
                      {v.roman}
                    </span>{" "}
                    <span className="text-muted">· {v.meaning}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <Section title="Sounds wrong?">
            {flagging ? (
              <FlagForm sentenceId={s.id} />
            ) : (
              <button type="button" onClick={() => setFlagging(true)} className="text-sm font-medium text-accent">
                Report this sentence
              </button>
            )}
          </Section>
        </div>
      </details>

      {s.script ? <SayIt roman={s.roman} /> : null}
    </article>
  );
}

export function LessonSession(props: Props) {
  const { sentences, showEnglish, showScript } = props;
  const byId = new Map(sentences.map((s) => [s.id, s]));
  const [started, setStarted] = useState(false);
  const [steps, setSteps] = useState(props.steps);
  const [index, setIndex] = useState(0);
  const [retried, setRetried] = useState<Set<number>>(new Set());
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [saved, setSaved] = useState<{ ok: boolean; queued: number } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const finished = started && index >= steps.length;

  // Save the lesson once, on reaching the end.
  useEffect(() => {
    if (!finished || saved) return;
    let live = true;
    finishLesson(props.unitSlug, props.lessonSlug).then((r) => live && setSaved(r));
    return () => {
      live = false;
    };
  }, [finished, saved, props.unitSlug, props.lessonSlug]);

  function playStep(i: number) {
    const step = steps[i];
    if (step?.kind === "learn") {
      const clip = byId.get(step.sentenceId)?.audio;
      if (clip) void playAudio(clip.normal);
    }
  }

  function advance() {
    const nextIndex = index + 1;
    setIndex(nextIndex);
    playStep(nextIndex); // inside the tap, so phones allow the sound
    top.current?.scrollIntoView({ block: "start" });
  }

  function onAnswered(r: ExerciseResult) {
    // First attempts count toward the score; a missed question comes back once at the end.
    if (!retried.has(index)) setScore((s) => ({ right: s.right + (r.right ? 1 : 0), total: s.total + 1 }));
    if (!r.right && !retried.has(index)) {
      setSteps((prev) => [...prev, prev[index]]);
      setRetried((prev) => new Set(prev).add(steps.length));
    }
    advance();
  }

  const progress = started ? Math.min(100, Math.round((index / steps.length) * 100)) : 0;
  const newCount = sentences.length;

  return (
    <div ref={top} className="scroll-mt-10">
      <div className="flex items-center gap-4">
        <Link href="/learn" aria-label="Leave the lesson" className="text-2xl leading-none text-muted">
          ✕
        </Link>
        <div
          className="h-4 flex-1 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Lesson progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-8">
        {!started ? (
          <section className="pb-40">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              {props.unitTitle} · Lesson {props.lessonPosition} of {props.lessonCount}
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">{props.lessonTitle}</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              {newCount} new {newCount === 1 ? "sentence" : "sentences"}, each with audio and how it works, and a quick
              question after every two.
            </p>
            <Link
              href={`/learn/${props.unitSlug}/${props.lessonSlug}/sentences`}
              className="mt-6 inline-block text-sm font-medium text-accent"
            >
              Just read all the sentences instead
            </Link>
            <BottomBar>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setStarted(true);
                  playStep(0);
                }}
                className={primaryButton}
              >
                Start
              </button>
            </BottomBar>
          </section>
        ) : finished ? (
          <section aria-label="Lesson complete" className="pb-56 text-center">
            <p className="text-6xl" aria-hidden="true">
              ✓
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Lesson complete</h1>
            <p className="mt-2 text-lg text-muted">{props.lessonTitle}</p>
            <dl className="mx-auto mt-8 grid max-w-xs grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl border-2 border-line p-4">
                <dt className="text-sm text-muted">New sentences</dt>
                <dd className="text-3xl font-semibold">{newCount}</dd>
              </div>
              <div className="rounded-2xl border-2 border-line p-4">
                <dt className="text-sm text-muted">Questions right</dt>
                <dd className="text-3xl font-semibold">
                  {score.right}/{score.total}
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-muted" role="status">
              {saved === null
                ? "Saving…"
                : saved.ok
                  ? saved.queued
                    ? `Saved. ${saved.queued} sentences join your revision.`
                    : "Saved."
                  : "Couldn't save. Check your connection; your practice still counts."}
            </p>
            <Link href={`/learn/${props.unitSlug}/${props.lessonSlug}/sentences`} className="mt-3 inline-block text-sm font-medium text-accent">
              See all the sentences
            </Link>
            <BottomBar>
              <Link
                href={props.next ? `/learn/${props.unitSlug}/${props.next.slug}` : "/learn"}
                className={primaryButton}
              >
                {props.next ? `Next: ${props.next.title}` : "Continue"}
              </Link>
              {props.next ? (
                <Link href="/learn" className="mt-3 block text-center font-medium text-muted">
                  Back to the path
                </Link>
              ) : null}
            </BottomBar>
          </section>
        ) : steps[index].kind === "learn" ? (
          (() => {
            const step = steps[index] as Extract<Step, { kind: "learn" }>;
            const s = byId.get(step.sentenceId)!;
            return (
              <div key={`learn-${index}`}>
                <NewSentence s={s} number={step.number} of={step.of} showEnglish={showEnglish} showScript={showScript} />
                <BottomBar>
                  <button type="button" onClick={advance} className={primaryButton}>
                    Continue
                  </button>
                </BottomBar>
              </div>
            );
          })()
        ) : (
          <Exercise
            key={`q-${index}`}
            q={(steps[index] as Extract<Step, { kind: "exercise" }>).question}
            onNext={onAnswered}
          />
        )}
      </div>
    </div>
  );
}
