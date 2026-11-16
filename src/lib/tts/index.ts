import "server-only";
import { createHash } from "node:crypto";
import { SarvamProvider } from "./sarvam";
import type { Speed, TtsProvider } from "./types";

export type { Speed } from "./types";
export { TtsError } from "./types";

/**
 * The configured voice service, or null when none is set up (the app then
 * falls back to the phone's own voice). Server-side only: keys never reach
 * the browser.
 */
export function getTtsProvider(env: Record<string, string | undefined> = process.env): TtsProvider | null {
  const key = env.SARVAM_API_KEY?.trim();
  if (key) {
    return new SarvamProvider({
      apiKey: key,
      baseUrl: env.SARVAM_API_BASE?.trim() || undefined,
      model: env.SARVAM_TTS_MODEL?.trim() || undefined,
      speaker: env.SARVAM_TTS_SPEAKER?.trim() || undefined,
    });
  }
  return null;
}

export type AudioUrls = { normal: string; slow: string };

/**
 * Addresses for a sentence's audio. The `v` value changes when the text or
 * the voice changes, so phones and Vercel's cache never play stale audio.
 */
export function audioUrlsFor(sentenceId: string, script: string | null, provider: TtsProvider | null): AudioUrls | null {
  if (!provider || !script) return null;
  const version = createHash("sha1").update(`${provider.cacheKey}\n${script}`).digest("hex").slice(0, 12);
  const url = (speed: Speed) => `/api/audio/${sentenceId}/${speed}?v=${version}`;
  return { normal: url("normal"), slow: url("slow") };
}

/** Addresses for a sentence built in the lab. */
export function labAudioUrls(
  patternId: string,
  wordId: string,
  endingId: string,
  script: string,
  provider: TtsProvider | null,
): AudioUrls | null {
  if (!provider) return null;
  const version = createHash("sha1").update(`${provider.cacheKey}\n${script}`).digest("hex").slice(0, 12);
  const url = (speed: Speed) => `/api/audio/lab/${patternId}/${wordId}/${endingId}/${speed}?v=${version}`;
  return { normal: url("normal"), slow: url("slow") };
}
