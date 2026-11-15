"use client";

import { useSyncExternalStore } from "react";

/**
 * Temporary audio: the phone's own Kannada voice, through the browser's
 * speech feature. Recorded audio replaces this in a later milestone.
 *
 * Reads the Kannada script aloud, because a Kannada voice cannot read
 * English letters correctly.
 */

const NORMAL_RATE = 0.9;
const SLOW_RATE = 0.6;

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

function speak(script: string, rate: number) {
  const voice = findKannadaVoice();
  if (!voice) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(script);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

const buttonClass =
  "inline-flex h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-40";

export function SpeakButtons({ script }: { script: string | null }) {
  const voice = useKannadaVoice();
  const ready = Boolean(script) && voice !== "none" && voice !== "unsupported" && voice !== "pending";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={buttonClass} disabled={!ready} onClick={() => speak(script!, NORMAL_RATE)}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
        Play
      </button>
      <button type="button" className={buttonClass} disabled={!ready} onClick={() => speak(script!, SLOW_RATE)}>
        Slow
      </button>
    </div>
  );
}

/** One line under the lesson title explaining where the sound comes from. */
export function VoiceStatus() {
  const voice = useKannadaVoice();
  if (voice === "pending") return null;
  if (voice === "none" || voice === "unsupported") {
    return (
      <p className="text-sm leading-relaxed text-muted">
        No Kannada voice on this device, so Play is off for now. On Android, search Settings for
        &ldquo;Text-to-speech&rdquo; and install Kannada voice data. Recorded audio is coming in a later update.
      </p>
    );
  }
  return <p className="text-sm text-muted">Audio uses your phone&apos;s Kannada voice for now.</p>;
}
