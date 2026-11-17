import { z } from "zod";
import { romanise } from "../../../content-pipeline/romanise";

/**
 * What the model must return, in two separate calls:
 *  - a CHECK of the learner's line (is it right, what did they mean), and
 *  - the tutor's in-character REPLY.
 * Splitting them stops the roleplay from crowding out the checking.
 */

export const MISTAKE_TAGS = [
  "wrong_case_ending",
  "wrong_verb_form",
  "wrong_person_ending",
  "wrong_word",
  "word_order",
  "register_mismatch",
  "missing_word",
  "spelling",
  "english_used",
  "other",
] as const;

export const CATEGORIES = ["none", "error", "unnatural", "register", "valid_variant", "unclear"] as const;

export const checkSchema = z.object({
  meant_english: z.string().max(300),
  category: z.enum(CATEGORIES),
  corrected_kannada: z.string().max(300),
  what_was_wrong: z.string().max(400),
  why: z.string().max(500),
  more_natural_kannada: z.string().max(300),
  tags: z.array(z.enum(MISTAKE_TAGS)),
});
export type LineCheck = z.infer<typeof checkSchema>;

export const replySchema = z.object({
  reply_kannada: z.string().min(1).max(400),
  reply_english: z.string().min(1).max(400),
  aside_english: z.string().max(600),
});
export type TutorReply = z.infer<typeof replySchema>;

export const CHECK_JSON_SCHEMA = {
  name: "line_check",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["meant_english", "category", "corrected_kannada", "what_was_wrong", "why", "more_natural_kannada", "tags"],
    properties: {
      meant_english: { type: "string", description: "What the learner was most likely trying to say, in English." },
      category: { type: "string", enum: [...CATEGORIES] },
      corrected_kannada: { type: "string", description: "The correct sentence in Kannada script, or empty." },
      what_was_wrong: { type: "string", description: "One short English sentence, or empty." },
      why: { type: "string", description: "One or two short English sentences, or empty." },
      more_natural_kannada: { type: "string", description: "How a Bengaluru speaker would say it, in Kannada script, or empty." },
      tags: { type: "array", items: { type: "string", enum: [...MISTAKE_TAGS] } },
    },
  },
} as const;

export const REPLY_JSON_SCHEMA = {
  name: "tutor_reply",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply_kannada", "reply_english", "aside_english"],
    properties: {
      reply_kannada: { type: "string", description: "Your next line in character, in Kannada script only." },
      reply_english: { type: "string", description: "Plain English translation of reply_kannada." },
      aside_english: {
        type: "string",
        description: "Only when the learner asked a question in English: a short answer in English. Otherwise empty.",
      },
    },
  },
} as const;

function parseWith<T>(schema: z.ZodType<T>, raw: string): T | null {
  const json = raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  try {
    const parsed = schema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export const parseCheck = (raw: string) => parseWith(checkSchema, raw);
export const parseReply = (raw: string) => parseWith(replySchema, raw);

/**
 * Kannada script → the app's English-letter spelling, done here rather than by
 * the model. ಫ is written "f": in Bengaluru speech it is usually said that way,
 * and it is in the words learners meet most (kāfi, ofis).
 */
export const toRoman = (script: string) =>
  romanise(script.normalize("NFC")).replace(/ph/g, "f").replace(/\s+/g, " ").trim();

export type StoredCorrection = {
  category: (typeof CATEGORIES)[number];
  meant: string | null;
  corrected_roman: string | null;
  corrected_script: string | null;
  what_was_wrong: string | null;
  why: string | null;
  natural_roman: string | null;
  natural_script: string | null;
  tags: string[];
};

const blankToNull = (s: string) => (s.trim() ? s.trim() : null);
const COUNTS_AS_MISTAKE = new Set(["error", "unnatural", "register"]);

export function toStoredCorrection(c: LineCheck): StoredCorrection {
  const corrected = blankToNull(c.corrected_kannada);
  const natural = blankToNull(c.more_natural_kannada);
  return {
    category: c.category,
    meant: blankToNull(c.meant_english),
    corrected_script: corrected,
    corrected_roman: corrected ? toRoman(corrected) : null,
    what_was_wrong: blankToNull(c.what_was_wrong),
    why: blankToNull(c.why),
    natural_script: natural,
    natural_roman: natural ? toRoman(natural) : null,
    tags: COUNTS_AS_MISTAKE.has(c.category) ? [...new Set(c.tags)] : [],
  };
}
