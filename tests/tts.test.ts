import { describe, expect, it } from "vitest";
import { audioUrlsFor, getTtsProvider } from "@/lib/tts";
import { SarvamProvider } from "@/lib/tts/sarvam";
import { TtsError } from "@/lib/tts/types";

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function fakeFetch(reply: { status?: number; json?: unknown; text?: string }) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const status = reply.status ?? 200;
    return new Response(reply.text ?? JSON.stringify(reply.json ?? {}), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const MP3 = Buffer.from("fake mp3 bytes");

describe("SarvamProvider", () => {
  it("sends Kannada script with the key, model, voice and pace", async () => {
    const { impl, calls } = fakeFetch({ json: { request_id: "r1", audios: [MP3.toString("base64")] } });
    const provider = new SarvamProvider({ apiKey: "secret", fetchImpl: impl });

    const result = await provider.synthesize({ text: "ನಮಸ್ಕಾರ", languageCode: "kn-IN", speed: "slow" });

    expect(calls[0].url).toBe("https://api.sarvam.ai/text-to-speech");
    expect(calls[0].headers["api-subscription-key"]).toBe("secret");
    expect(calls[0].body).toEqual({
      text: "ನಮಸ್ಕಾರ",
      language_code: "kn-IN",
      model: "bulbul:v3",
      speaker: "shubh",
      pace: 0.75,
      output_audio_codec: "mp3",
    });
    expect(Buffer.from(result.audio).toString()).toBe("fake mp3 bytes");
    expect(result.contentType).toBe("audio/mpeg");
  });

  it("uses normal pace for normal speed", async () => {
    const { impl, calls } = fakeFetch({ json: { audios: [MP3.toString("base64")] } });
    await new SarvamProvider({ apiKey: "k", fetchImpl: impl }).synthesize({
      text: "ಸರಿ",
      languageCode: "kn-IN",
      speed: "normal",
    });
    expect(calls[0].body.pace).toBe(1);
  });

  it("explains a refused key", async () => {
    const { impl } = fakeFetch({ status: 403, text: "invalid key" });
    const provider = new SarvamProvider({ apiKey: "bad", fetchImpl: impl });
    await expect(provider.synthesize({ text: "ಸರಿ", languageCode: "kn-IN", speed: "normal" })).rejects.toThrow(
      /key was refused/,
    );
  });

  it("reports an empty reply as an error", async () => {
    const { impl } = fakeFetch({ json: { audios: [] } });
    const provider = new SarvamProvider({ apiKey: "k", fetchImpl: impl });
    await expect(provider.synthesize({ text: "ಸರಿ", languageCode: "kn-IN", speed: "normal" })).rejects.toBeInstanceOf(
      TtsError,
    );
  });

  it("refuses text over Sarvam's limit without calling it", async () => {
    const { impl, calls } = fakeFetch({ json: {} });
    const provider = new SarvamProvider({ apiKey: "k", fetchImpl: impl });
    await expect(
      provider.synthesize({ text: "ಅ".repeat(2501), languageCode: "kn-IN", speed: "normal" }),
    ).rejects.toThrow(/longer than/);
    expect(calls).toHaveLength(0);
  });
});

describe("getTtsProvider", () => {
  it("is off when no key is set", () => {
    expect(getTtsProvider({})).toBeNull();
    expect(getTtsProvider({ SARVAM_API_KEY: "  " })).toBeNull();
  });

  it("uses Sarvam when its key is set, with optional voice settings", () => {
    expect(getTtsProvider({ SARVAM_API_KEY: "k" })?.cacheKey).toBe("sarvam:bulbul:v3:shubh");
    expect(getTtsProvider({ SARVAM_API_KEY: "k", SARVAM_TTS_SPEAKER: "kavya" })?.cacheKey).toBe(
      "sarvam:bulbul:v3:kavya",
    );
  });
});

describe("audioUrlsFor", () => {
  const id = "61e3e113-dc0f-5894-89ce-16ce7a993e6c";
  const sarvam = getTtsProvider({ SARVAM_API_KEY: "k" });
  const other = getTtsProvider({ SARVAM_API_KEY: "k", SARVAM_TTS_SPEAKER: "kavya" });

  it("gives a normal and a slow address", () => {
    const urls = audioUrlsFor(id, "ನಮಸ್ಕಾರ", sarvam)!;
    expect(urls.normal).toMatch(new RegExp(`^/api/audio/${id}/normal\\?v=[0-9a-f]{12}$`));
    expect(urls.slow).toMatch(new RegExp(`^/api/audio/${id}/slow\\?v=[0-9a-f]{12}$`));
  });

  it("changes the address when the text or the voice changes", () => {
    const a = audioUrlsFor(id, "ನಮಸ್ಕಾರ", sarvam)!.normal;
    expect(audioUrlsFor(id, "ನಮಸ್ಕಾರ", sarvam)!.normal).toBe(a);
    expect(audioUrlsFor(id, "ಸರಿ", sarvam)!.normal).not.toBe(a);
    expect(audioUrlsFor(id, "ನಮಸ್ಕಾರ", other)!.normal).not.toBe(a);
  });

  it("gives nothing without a provider or a script", () => {
    expect(audioUrlsFor(id, "ನಮಸ್ಕಾರ", null)).toBeNull();
    expect(audioUrlsFor(id, null, sarvam)).toBeNull();
  });
});
