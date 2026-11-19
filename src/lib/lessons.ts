import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Reading lessons. Every read goes through a database function
 * (supabase/migrations/0002_lessons.sql) that runs with the learner's own
 * permissions, so draft sentences never reach the app.
 */

export const LANGUAGE = "kn";

export type UnitSummary = {
  slug: string;
  title: string;
  position: number;
  lesson_count: number;
  completed_count: number;
};

export type LessonSummary = {
  slug: string;
  title: string;
  position: number;
  sentence_count: number;
  completed: boolean;
};

export type Unit = { slug: string; title: string; position: number; level: number; lessons: LessonSummary[] };

export type Token = { word: string; gloss: string; breakdown: string | null };
export type Variant = { relation: string; roman: string; meaning: string };

export type Sentence = {
  id: string;
  roman: string;
  script: string | null;
  meaning: string;
  why: string | null;
  pronunciation: string | null;
  register: "neutral" | "colloquial" | "formal";
  formality: "neutral" | "respectful" | "casual";
  region: string | null;
  status: "source_checked" | "native_verified";
  sources: string | null;
  tokens: Token[];
  variants: Variant[];
};

export type Lesson = {
  unit: { slug: string; title: string; position: number };
  lesson: { slug: string; title: string; position: number };
  lesson_count: number;
  completed: boolean;
  next_lesson: { slug: string; title: string } | null;
  sentences: Sentence[];
};

export class ContentUnavailableError extends Error {}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new ContentUnavailableError("Supabase is not connected.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new ContentUnavailableError(error.message);
  return data as T;
}

export const getUnits = (level = 1) => rpc<UnitSummary[]>("get_units", { p_language: LANGUAGE, p_level: level });

export const getUnit = (unitSlug: string) =>
  rpc<Unit | null>("get_unit", { p_unit_slug: unitSlug, p_language: LANGUAGE });

export const getLesson = (unitSlug: string, lessonSlug: string) =>
  rpc<Lesson | null>("get_lesson", { p_unit_slug: unitSlug, p_lesson_slug: lessonSlug, p_language: LANGUAGE });

/** URL segments are free text; only plain slugs reach the database. */
export const isSlug = (value: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 80;
