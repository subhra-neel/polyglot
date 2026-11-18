"use client";

import { useState } from "react";
import { compareSpoken, type SpokenResult } from "@/lib/speech-match";
import { useRecorder } from "@/lib/use-recorder";
import { MicIcon, StopIcon } from "./voice-input";

const VERDICT = {
  clear: { text: "Clear! Every word came through.", tone: "text-accent" },
  nearly: { text: "Nearly. Listen again and repeat the words in red.", tone: "text-accent" },
  again: { text: "Not quite. Play it slowly, then try again.", tone: "text-danger" },
} as const;

/**
 * Listen-and-repeat: the learner says the sentence, speech recognition writes
 * down what it heard, and each word is marked as heard or missed.
 */
export function SayIt({ roman }: { roman: string }) {
  const [heard, setHeard] = useState<string | null>(null);
  const [result, setResult] = useState<SpokenResult | null>(null);
  const { supported, state, error, start, stop } = useRecorder("practice", (text) => {
    setHeard(text);
    setResult(compareSpoken(roman, text));
  });
  if (!supported) return null;

  const label =
    state === "recording" ? "Stop" : state === "working" ? "Checking…" : result ? "Say it again" : "Say it";

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        onClick={state === "recording" ? stop : start}
        disabled={state === "working"}
        className={`flex h-11 items-center gap-2 rounded-full border px-4 font-medium disabled:opacity-50 ${
          state === "recording" ? "animate-pulse border-danger bg-danger text-white" : "border-line text-accent"
        }`}
      >
        {state === "recording" ? <StopIcon className="h-4 w-4" /> : <MicIcon className="h-5 w-5" />}
        {label}
      </button>
      {state === "recording" ? (
        <p className="mt-2 text-sm text-danger" role="status">
          Listening… say the sentence, then tap Stop.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {result && state === "idle" ? (
        <div className="mt-3" aria-label="How it went">
          <p className="text-lg leading-snug" lang="kn-Latn">
            {result.words.map((w, i) => (
              <span key={i} className={w.heard ? "text-accent" : "text-danger underline decoration-dotted"}>
                {w.word}
                {i < result.words.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          <p className={`mt-1 text-sm font-medium ${VERDICT[result.verdict].tone}`}>{VERDICT[result.verdict].text}</p>
          <p className="mt-1 text-sm text-muted">Heard: {heard}</p>
          <p className="mt-1 text-xs text-muted">A rough guide from speech recognition, not a pronunciation score.</p>
        </div>
      ) : null}
    </div>
  );
}
