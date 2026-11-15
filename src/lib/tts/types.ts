/**
 * A text-to-speech service. Each provider (Sarvam today; Google, ElevenLabs
 * or another later) implements this, so lessons never depend on one vendor.
 */
export type Speed = "normal" | "slow";

export type SynthesisRequest = {
  text: string; // Kannada script: voices pronounce it far better than English letters
  languageCode: string; // BCP-47, e.g. "kn-IN"
  speed: Speed;
};

export type Synthesis = { audio: Uint8Array; contentType: string };

export interface TtsProvider {
  /** Changes whenever the voice would sound different, so cached audio is replaced. */
  readonly cacheKey: string;
  synthesize(request: SynthesisRequest): Promise<Synthesis>;
}

export class TtsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
