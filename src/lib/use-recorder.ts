"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_MS = 25_000;

/** The best format this browser can record: WebM/Opus on Android and desktop, MP4/AAC on iPhone. */
function pickType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export type RecorderState = "idle" | "recording" | "working";

/**
 * Records a short clip and sends it to /api/stt. `purpose` "reply" keeps
 * English words in English (for the tutor); "practice" writes everything as
 * Kannada, for comparing with a lesson sentence.
 */
export function useRecorder(purpose: "reply" | "practice", onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  });

  useEffect(() => {
    // Decided after load so the first render matches the server's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(pickType() !== null && Boolean(navigator.mediaDevices?.getUserMedia));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Allow the microphone to use this.");
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
        const res = await fetch(`/api/stt?for=${purpose}`, { method: "POST", headers: { "content-type": blob.type }, body: blob });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) setError(body.error ?? "Couldn't hear that. Try again.");
        else if (!body.text) setError("Didn't catch any words. Try again, a little closer.");
        else callback.current(body.text);
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
  }, [purpose]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  return { supported, state, error, start, stop };
}
