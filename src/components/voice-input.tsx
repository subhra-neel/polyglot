"use client";

import { useEffect, useRef, useState } from "react";

const MAX_MS = 25_000;

/** The best format this browser can record: WebM/Opus on Android and desktop, MP4/AAC on iPhone. */
function pickType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

type State = "idle" | "recording" | "working";

/**
 * Tap to speak, tap again to stop. The recording is turned into text and
 * put in the reply box, so the learner can check it before sending.
 */
export function VoiceInput({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only shown where recording works; decided after load to match the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(pickType() !== null && Boolean(navigator.mediaDevices?.getUserMedia));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Allow the microphone to speak your reply.");
      return;
    }
    const type = pickType() ?? "";
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearTimeout(timer.current);
      const blob = new Blob(chunks, { type: (rec.mimeType || type || "audio/webm").split(";")[0] });
      if (!blob.size) {
        setState("idle");
        return;
      }
      setState("working");
      try {
        const res = await fetch("/api/stt", { method: "POST", headers: { "content-type": blob.type }, body: blob });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) setError(body.error ?? "Couldn't hear that. Try again, or type instead.");
        else if (!body.text) setError("Didn't catch any words. Try again, a little closer.");
        else onText(body.text);
      } catch {
        setError("Couldn't reach the app. Check your connection.");
      } finally {
        setState("idle");
      }
    };
    recorder.current = rec;
    rec.start();
    setState("recording");
    timer.current = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_MS);
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

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
        {state === "recording" ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
          </svg>
        )}
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
