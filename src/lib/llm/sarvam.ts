import { ChatError, type ChatProvider, type ChatRequest } from "./types";

/**
 * Sarvam chat completions (OpenAI-style): POST {base}/v1/chat/completions,
 * key in `api-subscription-key`, reply text in choices[0].message.content.
 * `response_format: json_schema` holds the reply to the tutor's schema.
 */
export class SarvamChat implements ChatProvider {
  readonly name: string;
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = "sarvam-105b-conversations",
    baseUrl = "https://api.sarvam.ai",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.name = `sarvam:${model}`;
  }

  async complete({ system, messages, schema, maxTokens = 900, effort = "low", temperature = 0.4 }: ChatRequest): Promise<string> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", "api-subscription-key": this.apiKey },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "system", content: system }, ...messages],
          temperature,
          max_tokens: maxTokens,
          reasoning_effort: effort,
          response_format: { type: "json_schema", json_schema: { name: schema.name, schema: schema.schema, strict: true } },
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      throw new ChatError(`Could not reach Sarvam: ${(error as Error).message}`, 502);
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new ChatError(`Sarvam chat replied ${response.status}. ${detail}`, response.status);
    }
    const body = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new ChatError("Sarvam chat returned no text.", 502);
    return content;
  }
}
