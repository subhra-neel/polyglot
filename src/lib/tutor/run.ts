import "server-only";
import type { ChatMessage, ChatProvider } from "@/lib/llm";
import { buildSystemPrompt, type LearnerContext, type Scenario } from "./prompt";
import { TURN_JSON_SCHEMA, type TutorTurn, parseTurn } from "./turn";

export type HistoryItem = { role: "tutor" | "learner"; text: string };

const MAX_HISTORY = 20;

/**
 * Asks the model for the next tutor turn. History goes in as plain text (the
 * tutor's Kannada, the learner's words); the reply must match the schema and
 * is retried once if it does not.
 */
export async function nextTutorTurn(
  provider: ChatProvider,
  scenario: Scenario,
  learner: LearnerContext,
  history: HistoryItem[],
): Promise<TutorTurn> {
  const messages: ChatMessage[] = history.slice(-MAX_HISTORY).map((h) => ({
    role: h.role === "tutor" ? "assistant" : "user",
    content: h.text,
  }));
  if (messages.length === 0 || messages[0].role === "assistant") {
    messages.unshift({ role: "user", content: "(The learner has just arrived. Begin the scene.)" });
  }

  const system = buildSystemPrompt(scenario, learner);
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider.complete({ system, messages, schema: TURN_JSON_SCHEMA });
    const turn = parseTurn(raw);
    if (turn) return turn;
  }
  throw new Error("The tutor's reply could not be read.");
}
