import "server-only";
import { SarvamChat } from "./sarvam";
import type { ChatProvider } from "./types";

export type { ChatMessage, ChatProvider } from "./types";
export { ChatError } from "./types";

/** The configured chat model, or null when none is set up. */
export function getChatProvider(env: Record<string, string | undefined> = process.env): ChatProvider | null {
  const key = env.SARVAM_API_KEY?.trim();
  if (!key) return null;
  return new SarvamChat(
    key,
    env.SARVAM_CHAT_MODEL?.trim() || undefined,
    env.SARVAM_API_BASE?.trim() || undefined,
  );
}
