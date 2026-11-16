import { describe, expect, it } from "vitest";
import { SarvamChat } from "@/lib/llm/sarvam";
import { buildSystemPrompt } from "@/lib/tutor/prompt";
import { nextTutorTurn } from "@/lib/tutor/run";
import { TURN_JSON_SCHEMA, parseTurn, toRoman, toStoredCorrection, type TutorTurn } from "@/lib/tutor/turn";
import type { ChatProvider, ChatRequest } from "@/lib/llm/types";

const none = { category: "none", corrected_kannada: "", what_was_wrong: "", why: "", more_natural_kannada: "", tags: [] } as const;
const turn = (over: Partial<TutorTurn> = {}): TutorTurn => ({
  reply_kannada: "ನಮಸ್ಕಾರ! ಏನು ಬೇಕು?",
  reply_english: "Hello! What would you like?",
  correction: { ...none, tags: [] },
  aside_english: "",
  ...over,
});

const scenario = {
  title: "Tea stall",
  persona: "Manju, who runs a small tea stall",
  setting: "A tea stall near a bus stop.",
  goals: "Order tea or coffee and pay.",
};
const learner = { level: 1, mistakes: [{ tag: "wrong_case_ending", occurrences: 3, example: {} }], known_sentences: ["namaskāra"] };

describe("parseTurn", () => {
  it("reads a reply that matches the schema", () => {
    expect(parseTurn(JSON.stringify(turn()))).toEqual(turn());
  });

  it("accepts a reply wrapped in a code fence", () => {
    expect(parseTurn("```json\n" + JSON.stringify(turn()) + "\n```")).toEqual(turn());
  });

  it("rejects text, missing fields and unknown categories or tags", () => {
    expect(parseTurn("namaskara")).toBeNull();
    expect(parseTurn(JSON.stringify({ reply_kannada: "ಸರಿ" }))).toBeNull();
    expect(parseTurn(JSON.stringify(turn({ correction: { ...none, category: "wrong" as never, tags: [] } })))).toBeNull();
    expect(parseTurn(JSON.stringify(turn({ correction: { ...none, tags: ["made_up" as never] } })))).toBeNull();
  });
});

describe("corrections", () => {
  it("spells Kannada script in the app's English letters", () => {
    expect(toRoman("ನನಗೆ ಕಾಫಿ ಬೇಕು")).toBe("nanage kāfi bēku");
  });

  it("stores an error with English spellings and its tags", () => {
    const stored = toStoredCorrection({
      category: "error",
      corrected_kannada: "ನನಗೆ ಕಾಫಿ ಬೇಕು",
      what_was_wrong: "nānu should be nanage.",
      why: "bēku takes the 'to me' form.",
      more_natural_kannada: "",
      tags: ["wrong_case_ending", "wrong_case_ending"],
    });
    expect(stored).toMatchObject({ category: "error", corrected_roman: "nanage kāfi bēku", natural_roman: null, tags: ["wrong_case_ending"] });
  });

  it("never records a mistake for a valid regional form", () => {
    const stored = toStoredCorrection({ ...none, category: "valid_variant", corrected_kannada: "ನನಗೆ", tags: ["spelling"] });
    expect(stored.tags).toEqual([]);
  });
});

describe("system prompt", () => {
  const prompt = buildSystemPrompt(scenario, learner);
  it("puts the tutor in character at the learner's level", () => {
    expect(prompt).toContain("Manju, who runs a small tea stall");
    expect(prompt).toContain("absolute beginner");
    expect(prompt).toContain("- namaskāra");
  });
  it("carries the learner's recurring mistakes and protects valid variants", () => {
    expect(prompt).toContain("wrong_case_ending (3 times)");
    expect(prompt).toContain("Never treat these as mistakes");
  });
});

describe("nextTutorTurn", () => {
  const fake = (replies: string[]) => {
    const calls: ChatRequest[] = [];
    const provider: ChatProvider = {
      name: "fake",
      complete: async (req) => {
        calls.push(req);
        return replies.shift() ?? "";
      },
    };
    return { provider, calls };
  };

  it("asks the tutor to open the scene when nobody has spoken", async () => {
    const { provider, calls } = fake([JSON.stringify(turn())]);
    await nextTutorTurn(provider, scenario, learner, []);
    expect(calls[0].messages).toEqual([{ role: "user", content: "(The learner has just arrived. Begin the scene.)" }]);
    expect(calls[0].schema).toBe(TURN_JSON_SCHEMA);
  });

  it("sends the tutor's lines as assistant turns and the learner's as user turns", async () => {
    const { provider, calls } = fake([JSON.stringify(turn())]);
    await nextTutorTurn(provider, scenario, learner, [
      { role: "tutor", text: "ನಮಸ್ಕಾರ" },
      { role: "learner", text: "ondu coffee beku" },
    ]);
    expect(calls[0].messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(calls[0].messages.at(-1)?.content).toBe("ondu coffee beku");
  });

  it("retries once when the reply cannot be read, then gives up", async () => {
    const ok = fake(["not json", JSON.stringify(turn())]);
    await expect(nextTutorTurn(ok.provider, scenario, learner, [])).resolves.toEqual(turn());
    const bad = fake(["no", "still no"]);
    await expect(nextTutorTurn(bad.provider, scenario, learner, [])).rejects.toThrow(/could not be read/);
    expect(bad.calls).toHaveLength(2);
  });
});

describe("Sarvam chat connector", () => {
  it("sends the key, model, system prompt and schema, and returns the reply text", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ choices: [{ message: { content: "{\"a\":1}" } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const chat = new SarvamChat("k", undefined, "https://example.test/", fetchImpl);
    const text = await chat.complete({ system: "S", messages: [{ role: "user", content: "hi" }], schema: TURN_JSON_SCHEMA });

    expect(text).toBe("{\"a\":1}");
    expect(seen!.url).toBe("https://example.test/v1/chat/completions");
    expect((seen!.init.headers as Record<string, string>)["api-subscription-key"]).toBe("k");
    const body = JSON.parse(seen!.init.body as string);
    expect(body.model).toBe("sarvam-105b-conversations");
    expect(body.messages[0]).toEqual({ role: "system", content: "S" });
    expect(body.response_format.json_schema.name).toBe("tutor_turn");
  });

  it("reports a refused key without leaking it", async () => {
    const fetchImpl = (async () => new Response("bad key", { status: 403 })) as unknown as typeof fetch;
    const chat = new SarvamChat("secret-key", undefined, undefined, fetchImpl);
    await expect(chat.complete({ system: "", messages: [], schema: TURN_JSON_SCHEMA })).rejects.toThrow(/403/);
    await expect(chat.complete({ system: "", messages: [], schema: TURN_JSON_SCHEMA })).rejects.not.toThrow(/secret-key/);
  });
});
