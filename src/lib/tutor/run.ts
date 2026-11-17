import "server-only";
import type { ChatMessage, ChatProvider } from "@/lib/llm";
import { buildSystemPrompt, type LearnerContext, type Scenario } from "./prompt";
import { REPLY_JSON_SCHEMA, type LineCheck, type TutorReply, parseReply } from "./turn";

export type HistoryItem = { role: "tutor" | "learner"; text: string };

const MAX_HISTORY = 20;

/**
 * Asks the model for the tutor's next line in character. The check of the
 * learner's last line (if any) is passed in, so the character can react to a
 * line it could not understand. Retried once if the reply cannot be read.
 */
export async function nextTutorTurn(
  provider: ChatProvider,
  scenario: Scenario,
  learner: LearnerContext,
  history: HistoryItem[],
  check?: LineCheck | null,
): Promise<TutorReply> {
  const messages: ChatMessage[] = history.slice(-MAX_HISTORY).map((h) => ({
    role: h.role === "tutor" ? "assistant" : "user",
    content: h.text,
  }));
  if (messages.length === 0 || messages[0].role === "assistant") {
    messages.unshift({ role: "user", content: "(The learner has just arrived. Begin the scene.)" });
  }
  const learnerTurns = history.filter((h) => h.role === "learner").length;

  const system = buildSystemPrompt(scenario, learner, { check: check ?? null, learnerTurns });
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider.complete({ system, messages, schema: REPLY_JSON_SCHEMA });
    const reply = parseReply(raw);
    if (reply) return reply;
  }
  throw new Error("The tutor's reply could not be read.");
}
