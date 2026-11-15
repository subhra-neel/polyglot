import data from "@/content/kn-patterns.json";
import { buildSentence, type BuiltSentence, type PatternFile } from "../../content-pipeline/patterns";

/**
 * Sentence-lab patterns, generated from content/kn/patterns.yaml by
 * `npm run content:build` (checked letter for letter there).
 */
export const PATTERNS = data as PatternFile;

export type Pattern = PatternFile["patterns"][number];
export type Word = PatternFile["words"][number];
export type { BuiltSentence };

export const getPattern = (id: string) => PATTERNS.patterns.find((p) => p.id === id) ?? null;
export const getWord = (id: string) => PATTERNS.words.find((w) => w.id === id) ?? null;

export const build = (patternId: string, wordId: string, endingId: string) =>
  buildSentence(PATTERNS, patternId, wordId, endingId);
