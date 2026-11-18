"use client";

import { useRecorder } from "@/lib/use-recorder";

export function MicIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  );
}

export function StopIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

/**
 * Tap to speak, tap again to stop. The recording is turned into text and
 * put in the reply box, so the learner can check it before sending.
 */
export function VoiceInput({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const { supported, state, error, start, stop } = useRecorder("reply", onText);
  if (!supported) return null;

  const label = state === "recording" ? "Stop and use what I said" : state === "working" ? "Listening back…" : "Speak your reply";
  return (
    <>
      <button
        type="button"
        onClick={state === "recording" ? stop : start}
        disabled={disabled || state === "working"}
        aria-label={label}
        title={label}
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border disabled:opacity-50 ${
          state === "recording" ? "animate-pulse border-danger bg-danger text-white" : "border-line bg-surface text-accent"
        }`}
      >
        {state === "recording" ? <StopIcon /> : <MicIcon />}
      </button>
      {state === "recording" ? (
        <p className="absolute -top-6 left-0 text-sm font-medium text-danger" role="status">
          Listening… tap ■ when you&apos;re done
        </p>
      ) : state === "working" ? (
        <p className="absolute -top-6 left-0 text-sm text-muted" role="status">
          Writing down what you said…
        </p>
      ) : error ? (
        <p className="absolute -top-6 left-0 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
