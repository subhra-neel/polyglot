import { z } from "zod";

/**
 * Shape of a content file (content/<language>/<unit>.yaml).
 * Changing this changes what authors may write, so keep it strict.
 */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lower-case words joined by hyphens");

// Polyglot romanisation: letters, macron vowels, spaces, light punctuation.
const roman = z
  .string()
  .min(1)
  .regex(/^[A-Za-zāīūēō' ?!.,-]+$/, "use English letters, ā ī ū ē ō, and capitals for retroflex T D N L");

const token = z
  .object({
    word: z.string().min(1),
    gloss: z.string().min(1),
    lemma: z.string().optional(),
    breakdown: z.string().optional(), // e.g. "hēge (how) + iddīri (you are)"
    tags: z.array(z.string()).default([]),
  })
  .strict();

const variant = z
  .object({
    relation: z.enum(["respectful", "casual", "more_natural", "alternative", "negative", "question"]),
    sentence: slug,
  })
  .strict();

export const sentenceSchema = z
  .object({
    id: slug,
    roman,
    script: z.string().min(1),
    meaning: z.string().min(1),
    why: z.string().min(1),
    pronunciation: z.string().optional(),
    register: z.enum(["neutral", "colloquial", "formal"]).default("neutral"),
    formality: z.enum(["neutral", "respectful", "casual"]).default("neutral"),
    region: z.string().optional(),
    status: z.enum(["draft", "source_checked", "native_verified"]),
    sources: z.array(z.string().min(1)).default([]),
    tokens: z.array(token).min(1),
    variants: z.array(variant).default([]),
  })
  .strict()
  .refine((s) => s.status === "draft" || s.sources.length > 0, {
    message: "a checked sentence must name at least one source",
    path: ["sources"],
  });

const lessonSchema = z
  .object({
    slug,
    title: z.string().min(1),
    sentences: z.array(sentenceSchema).min(1),
  })
  .strict();

export const unitFileSchema = z
  .object({
    language: z.enum(["kn", "ta", "te"]),
    level: z.number().int().min(1).max(5),
    unit: slug,
    lessons: z.array(lessonSchema).min(1),
    // Sentences that are not cards themselves: alternative ways of saying a card.
    alternatives: z.array(sentenceSchema).default([]),
  })
  .strict();

export type UnitFile = z.infer<typeof unitFileSchema>;
export type Sentence = z.infer<typeof sentenceSchema>;
