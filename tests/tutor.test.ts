import { describe, expect, it } from "vitest";
import { SarvamChat } from "@/lib/llm/sarvam";
import type { ChatProvider, ChatRequest } from "@/lib/llm/types";
import { CHECK_SYSTEM, checkLearnerLine } from "@/lib/tutor/check";
import { GOLDEN } from "@/lib/tutor/golden";
import { buildSystemPrompt } from "@/lib/tutor/prompt";
import { nextTutorTurn } from "@/lib/tutor/run";
import {
  CHECK_JSON_SCHEMA,
  CATEGORIES,
  type LineCheck,
  REPLY_JSON_SCHEMA,
  type TutorReply,
  parseCheck,
  parseReply,
  toRoman,
  toStoredCorrection,
} from "@/lib/tutor/turn";

const reply = (over: Partial<TutorReply> = {}): TutorReply => ({
  reply_kannada: "ನಮಸ್ಕಾರ! ಏನು ಬೇಕು?",
  reply_english: "Hello! What would you like?",
  aside_english: "",
  ...over,
});
const check = (over: Partial<LineCheck> = {}): LineCheck => ({
  meant_english: "I'm fine",
  category: "none",
  corrected_kannada: "",
  what_was_wrong: "",
  why: "",
  more_natural_kannada: "",
  tags: [],
  ...over,
});

const scenario = {
  title: "Tea stall",
  persona: "Manju, who runs a small tea stall",
  setting: "A tea stall near a bus stop.",
  goals: "Order tea or coffee and pay.",
};
const learner = { level: 1, mistakes: [{ tag: "wrong_case_ending", occurrences: 3, example: {} }], known_sentences: ["namaskāra"] };

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

describe("reading model replies", () => {
  it("reads a reply and a check that match their schemas, even in a code fence", () => {
    expect(parseReply(JSON.stringify(reply()))).toEqual(reply());
    expect(parseCheck("```json\n" + JSON.stringify(check()) + "\n```")).toEqual(check());
  });

  it("rejects text, missing fields and unknown categories or tags", () => {
    expect(parseReply("namaskara")).toBeNull();
    expect(parseReply(JSON.stringify({ reply_kannada: "ಸರಿ" }))).toBeNull();
    expect(parseCheck(JSON.stringify(check({ category: "wrong" as never })))).toBeNull();
    expect(parseCheck(JSON.stringify(check({ tags: ["made_up" as never] })))).toBeNull();
  });
});

describe("corrections", () => {
  it("spells Kannada script in the app's English letters", () => {
    expect(toRoman("ನನಗೆ ಕಾಫಿ ಬೇಕು")).toBe("nanage kāfi bēku");
  });

  it("stores an error with English spellings, what was meant and its tags", () => {
    const stored = toStoredCorrection(
      check({
        meant_english: "I want coffee",
        category: "error",
        corrected_kannada: "ನನಗೆ ಕಾಫಿ ಬೇಕು",
        what_was_wrong: "nānu should be nanage.",
        tags: ["wrong_case_ending", "wrong_case_ending"],
      }),
    );
    expect(stored).toMatchObject({
      category: "error",
      meant: "I want coffee",
      corrected_roman: "nanage kāfi bēku",
      natural_roman: null,
      tags: ["wrong_case_ending"],
    });
  });

  it("never records a mistake for a valid spoken form or an unclear line", () => {
    expect(toStoredCorrection(check({ category: "valid_variant", tags: ["spelling"] })).tags).toEqual([]);
    expect(toStoredCorrection(check({ category: "unclear", tags: ["other"] })).tags).toEqual([]);
  });
});

describe("the checker", () => {
  it("sends the tutor's line, the learner's line and recurring mistakes, carefully", async () => {
    const { provider, calls } = fake([JSON.stringify(check({ category: "error" }))]);
    const result = await checkLearnerLine(provider, {
      tutorLine: "ಹೇಗಿದ್ದೀರಾ?",
      said: "chennagide",
      scenario,
      recurring: ["wrong_person_ending"],
    });
    expect(result.category).toBe("error");
    expect(calls[0].system).toBe(CHECK_SYSTEM);
    expect(calls[0].schema).toBe(CHECK_JSON_SCHEMA);
    expect(calls[0].effort).toBe("medium");
    expect(calls[0].messages[0].content).toContain("Tutor: ಹೇಗಿದ್ದೀರಾ?");
    expect(calls[0].messages[0].content).toContain("Learner: chennagide");
    expect(calls[0].messages[0].content).toContain("wrong_person_ending");
  });

  it("retries once, then gives up", async () => {
    const bad = fake(["no", "still no"]);
    await expect(checkLearnerLine(bad.provider, { tutorLine: null, said: "x", scenario })).rejects.toThrow(/could not be read/);
    expect(bad.calls).toHaveLength(2);
  });

  it("teaches the mistakes from this learner's real conversation and protects spoken forms", () => {
    expect(CHECK_SYSTEM).toContain("chennāgide");
    expect(CHECK_SYSTEM).toContain("uta martara");
    expect(CHECK_SYSTEM).toContain("Shortened spoken forms");
    expect(CHECK_SYSTEM).toContain("Spelling in English letters is never a mistake");
  });
});

describe("golden test lines", () => {
  it("cover both mistakes to catch and spoken forms to accept, with valid verdicts", () => {
    const valid = new Set<string>(CATEGORIES);
    for (const c of GOLDEN) for (const e of c.expect) expect(valid.has(e)).toBe(true);
    expect(GOLDEN.filter((c) => c.expect.includes("none")).length).toBeGreaterThanOrEqual(5);
    expect(GOLDEN.filter((c) => !c.expect.includes("none")).length).toBeGreaterThanOrEqual(5);
    expect(new Set(GOLDEN.map((c) => c.id)).size).toBe(GOLDEN.length);
  });
});

describe("reply prompt", () => {
  const prompt = buildSystemPrompt(scenario, learner);
  it("puts the tutor in character at the learner's level", () => {
    expect(prompt).toContain("Manju, who runs a small tea stall");
    expect(prompt).toContain("absolute beginner");
    expect(prompt).toContain("- namaskāra");
    expect(prompt).toContain("wrong_case_ending (3 times)");
  });

  it("keeps the scene going and spells standard Kannada", () => {
    expect(buildSystemPrompt(scenario, learner, { check: null, learnerTurns: 2 })).toContain("replied 2 times");
    expect(prompt).toContain("Do not say goodbye or end the scene");
    expect(prompt).toContain("ಚೆನ್ನಾಗಿ, not ಚನ್ನಾಗಿ");
  });

  it("asks the character to check again when the learner was unclear, and not to correct otherwise", () => {
    const unclear = buildSystemPrompt(scenario, learner, { check: check({ category: "unclear", meant_english: "I ate" }), learnerTurns: 1 });
    expect(unclear).toContain("UNCLEAR");
    expect(unclear).toContain("I ate");
    const clear = buildSystemPrompt(scenario, learner, { check: check(), learnerTurns: 1 });
    expect(clear).toContain("do not correct");
  });
});

describe("nextTutorTurn", () => {
  it("asks the tutor to open the scene when nobody has spoken", async () => {
    const { provider, calls } = fake([JSON.stringify(reply())]);
    await nextTutorTurn(provider, scenario, learner, []);
    expect(calls[0].messages).toEqual([{ role: "user", content: "(The learner has just arrived. Begin the scene.)" }]);
    expect(calls[0].schema).toBe(REPLY_JSON_SCHEMA);
  });

  it("sends the tutor's lines as assistant turns and the learner's as user turns", async () => {
    const { provider, calls } = fake([JSON.stringify(reply())]);
    await nextTutorTurn(provider, scenario, learner, [
      { role: "tutor", text: "ನಮಸ್ಕಾರ" },
      { role: "learner", text: "ondu coffee beku" },
    ]);
    expect(calls[0].messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(calls[0].messages.at(-1)?.content).toBe("ondu coffee beku");
  });

  it("retries once when the reply cannot be read, then gives up", async () => {
    const ok = fake(["not json", JSON.stringify(reply())]);
    await expect(nextTutorTurn(ok.provider, scenario, learner, [])).resolves.toEqual(reply());
    const bad = fake(["no", "still no"]);
    await expect(nextTutorTurn(bad.provider, scenario, learner, [])).rejects.toThrow(/could not be read/);
  });
});

describe("Sarvam chat connector", () => {
  it("sends the key, model, effort, system prompt and schema, and returns the reply text", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ choices: [{ message: { content: "{\"a\":1}" } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const chat = new SarvamChat("k", undefined, "https://example.test/", fetchImpl);
    const text = await chat.complete({
      system: "S",
      messages: [{ role: "user", content: "hi" }],
      schema: CHECK_JSON_SCHEMA,
      effort: "medium",
      temperature: 0.1,
    });

    expect(text).toBe("{\"a\":1}");
    expect(seen!.url).toBe("https://example.test/v1/chat/completions");
    expect((seen!.init.headers as Record<string, string>)["api-subscription-key"]).toBe("k");
    const body = JSON.parse(seen!.init.body as string);
    expect(body.model).toBe("sarvam-105b-conversations");
    expect(body.messages[0]).toEqual({ role: "system", content: "S" });
    expect(body.response_format.json_schema.name).toBe("line_check");
    expect(body.reasoning_effort).toBe("medium");
    expect(body.temperature).toBe(0.1);
  });

  it("reports a refused key without leaking it", async () => {
    const fetchImpl = (async () => new Response("bad key", { status: 403 })) as unknown as typeof fetch;
    const chat = new SarvamChat("secret-key", undefined, undefined, fetchImpl);
    await expect(chat.complete({ system: "", messages: [], schema: REPLY_JSON_SCHEMA })).rejects.toThrow(/403/);
    await expect(chat.complete({ system: "", messages: [], schema: REPLY_JSON_SCHEMA })).rejects.not.toThrow(/secret-key/);
  });
});
