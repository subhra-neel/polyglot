import { z } from "zod";
import { romanise } from "../../../content-pipeline/romanise";

/**
 * One tutor turn as the model must return it, and the checks applied before
 * anything is shown or stored.
 */

export const MISTAKE_TAGS = [
  "wrong_case_ending",
  "wrong_verb_form",
  "wrong_word",
  "word_order",
  "register_mismatch",
  "missing_word",
  "spelling",
  "english_used",
  "other",
] as const;

export const CATEGORIES = ["none", "error", "unnatural", "register", "valid_variant"] as const;

const correctionSchema = z.object({
  category: z.enum(CATEGORIES),
  corrected_kannada: z.string(),
  what_was_wrong: z.string(),
  why: z.string(),
  more_natural_kannada: z.string(),
  tags: z.array(z.enum(MISTAKE_TAGS)),
});

export const turnSchema = z.object({
  reply_kannada: z.string().min(1).max(400),
  reply_english: z.string().min(1).max(400),
  correction: correctionSchema,
  aside_english: z.string().max(600),
});

export type TutorTurn = z.infer<typeof turnSchema>;

/** The same shape as JSON Schema, sent to the model with every request. */
export const TURN_JSON_SCHEMA = {
  name: "tutor_turn",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply_kannada", "reply_english", "correction", "aside_english"],
    properties: {
      reply_kannada: { type: "string", description: "Your next line in character, in Kannada script only." },
      reply_english: { type: "string", description: "Plain English translation of reply_kannada." },
      aside_english: {
        type: "string",
        description: "Only when the learner asked a question in English: a short answer in English. Otherwise empty.",
      },
      correction: {
        type: "object",
        additionalProperties: false,
        required: ["category", "corrected_kannada", "what_was_wrong", "why", "more_natural_kannada", "tags"],
        properties: {
          category: { type: "string", enum: [...CATEGORIES] },
          corrected_kannada: { type: "string", description: "Corrected sentence in Kannada script, or empty." },
          what_was_wrong: { type: "string", description: "One short English sentence, or empty." },
          why: { type: "string", description: "One or two short English sentences, or empty." },
          more_natural_kannada: { type: "string", description: "How a Bengaluru speaker would say it, in Kannada script, or empty." },
          tags: { type: "array", items: { type: "string", enum: [...MISTAKE_TAGS] } },
        },
      },
    },
  },
} as const;

export function parseTurn(raw: string): TutorTurn | null {
  const json = raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  try {
    const parsed = turnSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Kannada script → the app's English-letter spelling, done here rather than by
 * the model. ಫ is written "f": in Bengaluru speech it is usually said that way,
 * and it is in the words learners meet most (kāfi, ofis).
 */
export const toRoman = (script: string) =>
  romanise(script.normalize("NFC")).replace(/ph/g, "f").replace(/\s+/g, " ").trim();

export type StoredCorrection = {
  category: (typeof CATEGORIES)[number];
  corrected_roman: string | null;
  corrected_script: string | null;
  what_was_wrong: string | null;
  why: string | null;
  natural_roman: string | null;
  natural_script: string | null;
  tags: string[];
};

const blankToNull = (s: string) => (s.trim() ? s.trim() : null);

export function toStoredCorrection(c: TutorTurn["correction"]): StoredCorrection {
  const corrected = blankToNull(c.corrected_kannada);
  const natural = blankToNull(c.more_natural_kannada);
  return {
    category: c.category,
    corrected_script: corrected,
    corrected_roman: corrected ? toRoman(corrected) : null,
    what_was_wrong: blankToNull(c.what_was_wrong),
    why: blankToNull(c.why),
    natural_script: natural,
    natural_roman: natural ? toRoman(natural) : null,
    tags: c.category === "error" || c.category === "unnatural" || c.category === "register" ? [...new Set(c.tags)] : [],
  };
}
