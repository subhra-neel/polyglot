import "server-only";
import { SarvamStt, type SttProvider } from "./sarvam";

export { SttError, type SttProvider } from "./sarvam";

/** The configured speech-to-text service, or null. Server-side only. */
export function getSttProvider(env: Record<string, string | undefined> = process.env): SttProvider | null {
  const key = env.SARVAM_API_KEY?.trim();
  if (!key) return null;
  return new SarvamStt(
    key,
    env.SARVAM_STT_MODEL?.trim() || undefined,
    env.SARVAM_STT_MODE?.trim() || undefined,
    env.SARVAM_API_BASE?.trim() || undefined,
  );
}
