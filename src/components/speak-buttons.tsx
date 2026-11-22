"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * Play and Slow for one sentence.
 *
 * With a voice service set up (Sarvam), each button plays recorded audio from
 * /api/audio/…, generated once and then cached. Without one, or if that audio
 * fails to load, it falls back to the phone's own Kannada voice, reading the
 * Kannada script (a Kannada voice cannot read English letters correctly).
 */

export type AudioUrls = { normal: string; slow: string };
type Speed = keyof AudioUrls;

const DEVICE_RATE: Record<Speed, number> = { normal: 0.9, slow: 0.6 };

function findKannadaVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis
    .getVoices()
    .find((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith("kn"));
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}

// "unsupported" = no speech feature, "none" = no Kannada voice, else the voice name.
function getSnapshot(): string {
  if (!("speechSynthesis" in window)) return "unsupported";
  return findKannadaVoice()?.name ?? "none";
}

export function useKannadaVoice() {
  return useSyncExternalStore(subscribe, getSnapshot, () => "pending");
}

const hasDeviceVoice = (voice: string) => voice !== "none" && voice !== "unsupported" && voice !== "pending";

function speakWithDevice(script: string, speed: Speed): boolean {
  const voice = findKannadaVoice();
  if (!voice) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(script);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = DEVICE_RATE[speed];
  window.speechSynthesis.speak(utterance);
  return true;
}

// One sentence plays at a time across the whole page.
let playing: HTMLAudioElement | null = null;

function stopEverything() {
  playing?.pause();
  playing = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Plays a recorded clip on its own (used by the tutor's voice mode). Resolves false if the browser blocks it. */
export async function playAudio(url: string): Promise<boolean> {
  stopEverything();
  const element = new Audio(url);
  playing = element;
  try {
    await element.play();
    return true;
  } catch {
    return false;
  }
}

const buttonClass =
  "inline-flex h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-40";

export function SpeakButtons({ script, audio }: { script: string | null; audio: AudioUrls | null }) {
  const voice = useKannadaVoice();
  const [loading, setLoading] = useState<Speed | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const canPlay = Boolean(audio) || (Boolean(script) && hasDeviceVoice(voice));

  async function play(speed: Speed) {
    setProblem(null);
    stopEverything();

    if (audio) {
      const element = new Audio(audio[speed]);
      playing = element;
      setLoading(speed);
      try {
        await element.play();
        return;
      } catch {
        // Fall through to the phone's voice.
      } finally {
        setLoading(null);
      }
    }

    if (!script || !speakWithDevice(script, speed)) {
      setProblem("The audio could not load. Check your connection and try again.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} disabled={!canPlay} onClick={() => play("normal")}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
          {loading === "normal" ? "Loading…" : "Play"}
        </button>
        <button type="button" className={buttonClass} disabled={!canPlay} onClick={() => play("slow")}>
          {loading === "slow" ? "Loading…" : "Slow"}
        </button>
      </div>
      {problem ? (
        <p role="status" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** One line under the lesson title, shown only when relying on the phone's voice. */
export function VoiceStatus({ recordedAudio }: { recordedAudio: boolean }) {
  const voice = useKannadaVoice();
  if (recordedAudio || voice === "pending") return null;
  if (!hasDeviceVoice(voice)) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        No Kannada voice on this device, so Play is off for now. On Android, search Settings for
        &ldquo;Text-to-speech&rdquo; and install Kannada voice data.
      </p>
    );
  }
  return <p className="text-sm text-muted">Audio uses your phone&apos;s Kannada voice for now.</p>;
}
