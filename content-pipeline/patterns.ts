import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { normaliseRoman, romanise } from "./romanise.ts";

/**
 * Sentence-lab patterns: validated here, then written to
 * src/content/<language>-patterns.json for the app to import.
 */

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const roman = z.string().regex(/^[A-Za-zāīūēō' ?!.,-]+$/);

const wordSchema = z
  .object({ id, roman, script: z.string().min(1), gloss: z.string().min(1), sources: z.array(z.string()).min(1) })
  .strict();

const endingSchema = z
  .object({
    id: z.enum(["statement", "negative", "question"]),
    label: z.string().min(1),
    roman,
    script: z.string().min(1),
    english: z.string().includes("{word}"),
  })
  .strict();

const patternSchema = z
  .object({
    id,
    title: z.string().min(1),
    template: z.string().includes("{word}").includes("{ending}"),
    template_script: z.string().includes("{word}").includes("{ending}"),
    explanation: z.string().min(1),
    note: z.string().optional(),
    sources: z.array(z.string()).min(1),
    endings: z.array(endingSchema).min(1),
    words: z.array(z.object({ word: id, english: z.string().min(1) }).strict()).min(2),
  })
  .strict();

export const patternFileSchema = z
  .object({ language: z.enum(["kn", "ta", "te"]), words: z.array(wordSchema), patterns: z.array(patternSchema) })
  .strict();

export type PatternFile = z.infer<typeof patternFileSchema>;

export type BuiltSentence = { roman: string; script: string; english: string };

/** The one way a sentence is put together, used by the checks and the app. */
export function buildSentence(file: PatternFile, patternId: string, wordId: string, endingId: string): BuiltSentence | null {
  const pattern = file.patterns.find((p) => p.id === patternId);
  const ending = pattern?.endings.find((e) => e.id === endingId);
  const slot = pattern?.words.find((w) => w.word === wordId);
  const word = file.words.find((w) => w.id === wordId);
  if (!pattern || !ending || !slot || !word) return null;
  return {
    roman: pattern.template.replace("{word}", word.roman).replace("{ending}", ending.roman),
    script: pattern.template_script.replace("{word}", word.script).replace("{ending}", ending.script),
    english: capitalise(ending.english.replace("{word}", slot.english)),
  };
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function checkPatterns(data: unknown): { file?: PatternFile; problems: string[] } {
  const parsed = patternFileSchema.safeParse(data);
  if (!parsed.success) {
    return { problems: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const file = parsed.data;
  const problems: string[] = [];
  const words = new Map(file.words.map((w) => [w.id, w]));

  const sameRoman = (where: string, r: string, script: string) => {
    try {
      const fromScript = normaliseRoman(romanise(script));
      if (fromScript !== normaliseRoman(r)) problems.push(`${where}: "${r}" does not match script, which reads "${fromScript}"`);
    } catch (error) {
      problems.push(`${where}: ${(error as Error).message}`);
    }
  };

  for (const w of file.words) sameRoman(`word ${w.id}`, w.roman, w.script);
  if (words.size !== file.words.length) problems.push("a word id is used twice");

  for (const p of file.patterns) {
    sameRoman(
      `pattern ${p.id} template`,
      p.template.replace("{word}", "").replace("{ending}", ""),
      p.template_script.replace("{word}", "").replace("{ending}", ""),
    );
    for (const e of p.endings) sameRoman(`pattern ${p.id} ending ${e.id}`, e.roman, e.script);
    for (const slot of p.words) {
      if (!words.has(slot.word)) problems.push(`pattern ${p.id}: word "${slot.word}" is not in the word list`);
    }
    // Every sentence the lab can build must pass the same letter-for-letter check.
    for (const slot of p.words) {
      for (const e of p.endings) {
        const built = buildSentence(file, p.id, slot.word, e.id);
        if (built) sameRoman(`pattern ${p.id} (${slot.word}, ${e.id})`, built.roman, built.script);
      }
    }
  }
  return { file, problems };
}

export const loadPatterns = (path: string) => checkPatterns(parse(readFileSync(path, "utf8")));
