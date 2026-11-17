/** A chat model behind a small interface, so the tutor can switch providers. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  system: string;
  messages: ChatMessage[];
  /** JSON Schema the reply must follow. */
  schema: { name: string; schema: Record<string, unknown> };
  maxTokens?: number;
  /** How hard the model should think. Checking needs more care than chatting. */
  effort?: "low" | "medium" | "high";
  temperature?: number;
};

export interface ChatProvider {
  readonly name: string;
  complete(request: ChatRequest): Promise<string>;
}

export class ChatError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
