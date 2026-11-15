import { type Synthesis, type SynthesisRequest, TtsError, type TtsProvider } from "./types";

/**
 * Sarvam AI "Bulbul" voices (https://docs.sarvam.ai).
 * POST {base}/text-to-speech with the key in `api-subscription-key`;
 * the reply carries base64 audio in `audios[0]`.
 */
export type SarvamOptions = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  speaker?: string;
  fetchImpl?: typeof fetch;
};

const PACE = { normal: 1, slow: 0.75 } as const;
const MAX_CHARS = 2500; // documented limit for bulbul:v3
const TIMEOUT_MS = 20_000;

export class SarvamProvider implements TtsProvider {
  readonly cacheKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly speaker: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SarvamOptions) {
    this.baseUrl = (options.baseUrl ?? "https://api.sarvam.ai").replace(/\/+$/, "");
    this.model = options.model ?? "bulbul:v3";
    this.speaker = options.speaker ?? "shubh";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cacheKey = `sarvam:${this.model}:${this.speaker}`;
  }

  async synthesize({ text, languageCode, speed }: SynthesisRequest): Promise<Synthesis> {
    if (!text.trim()) throw new TtsError("Nothing to say.", 400);
    if (text.length > MAX_CHARS) throw new TtsError(`Text is longer than ${MAX_CHARS} characters.`, 400);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/text-to-speech`, {
        method: "POST",
        headers: { "content-type": "application/json", "api-subscription-key": this.options.apiKey },
        body: JSON.stringify({
          text,
          language_code: languageCode,
          model: this.model,
          speaker: this.speaker,
          pace: PACE[speed],
          output_audio_codec: "mp3",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new TtsError(`Could not reach Sarvam: ${(error as Error).message}`, 502);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const hint =
        response.status === 403 || response.status === 401
          ? "The Sarvam key was refused. Check SARVAM_API_KEY in Vercel."
          : response.status === 429
            ? "Sarvam's rate limit or credit was reached."
            : `Sarvam replied ${response.status}.`;
      throw new TtsError(`${hint} ${detail.slice(0, 200)}`.trim(), response.status);
    }

    const body = (await response.json().catch(() => null)) as { audios?: unknown } | null;
    const base64 = Array.isArray(body?.audios) ? body.audios[0] : undefined;
    if (typeof base64 !== "string" || !base64) throw new TtsError("Sarvam returned no audio.", 502);

    return { audio: new Uint8Array(Buffer.from(base64, "base64")), contentType: "audio/mpeg" };
  }
}
