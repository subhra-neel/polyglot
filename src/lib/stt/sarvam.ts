/**
 * Speech to text behind a small interface, so the provider can be swapped.
 * First provider: Sarvam (POST {base}/speech-to-text, multipart, key in
 * `api-subscription-key`). Mode "codemix" keeps English words in English
 * letters and Kannada words in Kannada script, which suits learners who mix
 * "coffee" or "bye" into Kannada.
 */
export class SttError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface SttProvider {
  readonly name: string;
  /** `mode` overrides the default (e.g. "transcribe" for all-Kannada output). */
  transcribe(audio: Blob, languageCode: string, mode?: string): Promise<string>;
}

export class SarvamStt implements SttProvider {
  readonly name: string;
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = "saaras:v3",
    private readonly mode = "codemix",
    baseUrl = "https://api.sarvam.ai",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.name = `sarvam:${model}:${mode}`;
  }

  async transcribe(audio: Blob, languageCode: string, mode = this.mode): Promise<string> {
    const form = new FormData();
    const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("wav") ? "wav" : "webm";
    form.append("file", audio, `speech.${ext}`);
    form.append("model", this.model);
    form.append("language_code", languageCode);
    if (mode) form.append("mode", mode);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/speech-to-text`, {
        method: "POST",
        headers: { "api-subscription-key": this.apiKey },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new SttError(`Could not reach Sarvam: ${(error as Error).message}`, 502);
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new SttError(`Sarvam speech-to-text replied ${response.status}. ${detail}`, response.status);
    }
    const body = (await response.json().catch(() => null)) as { transcript?: string } | null;
    if (typeof body?.transcript !== "string") throw new SttError("Sarvam returned no transcript.", 502);
    return body.transcript;
  }
}
