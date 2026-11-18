import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { normaliseRoman, romanise } from "./romanise.ts";

/**
 * Tutor scenes: who the tutor plays, where, and what the learner should
 * manage to do. Written into supabase/content.sql with the lessons. Each
 * "try" phrase with a script is checked letter for letter like a sentence.
 */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const tryPhrase = z
  .object({ roman: z.string().min(1), script: z.string().min(1).optional() })
  .strict();

const sceneSchema = z
  .object({
    slug,
    title: z.string().min(1),
    persona: z.string().min(20),
    setting: z.string().min(1),
    goals: z.string().min(1),
    try: z.array(tryPhrase).min(1).max(4),
    min_level: z.number().int().min(1).max(5).default(1),
    uses_units: z.array(z.string()).default([]),
  })
  .strict();

const fileSchema = z.object({ language: z.string().regex(/^[a-z]{2}$/), scenes: z.array(sceneSchema).min(1) }).strict();

export type ScenesFile = z.infer<typeof fileSchema>;

export function loadScenes(path: string): { file?: ScenesFile; problems: string[] } {
  let data: unknown;
  try {
    data = parse(readFileSync(path, "utf8"));
  } catch (error) {
    return { problems: [(error as Error).message] };
  }
  const parsed = fileSchema.safeParse(data);
  if (!parsed.success) {
    return { problems: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const scene of parsed.data.scenes) {
    if (seen.has(scene.slug)) problems.push(`${scene.slug}: duplicate slug`);
    seen.add(scene.slug);
    for (const phrase of scene.try) {
      if (!phrase.script) continue;
      const expected = normaliseRoman(romanise(phrase.script));
      if (normaliseRoman(phrase.roman) !== expected) {
        problems.push(`${scene.slug}: try "${phrase.roman}" does not match its script (expected "${romanise(phrase.script)}")`);
      }
    }
  }
  return { file: parsed.data, problems };
}

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

export const openingHint = (scene: ScenesFile["scenes"][number]) => `Try: ${scene.try.map((t) => t.roman).join(" · ")}`;

/** Upserts the scenes by slug. Conversations already held keep pointing at their scene. */
export function scenesToSql(file: ScenesFile): string {
  const rows = file.scenes.map(
    (s, i) =>
      `  (${q(file.language)}, ${q(s.slug)}, ${q(s.title)}, ${q(s.persona)}, ${q(s.setting)}, ${q(s.goals)}, ${q(openingHint(s))}, ${s.min_level}, ${i + 1})`,
  );
  return [
    `-- ${file.language} tutor scenes`,
    "begin;",
    "insert into public.scenarios (language_code, slug, title, persona, setting, goals, opening_hint, min_level, position) values",
    rows.join(",\n"),
    "on conflict (language_code, slug) do update set",
    "  title = excluded.title, persona = excluded.persona, setting = excluded.setting, goals = excluded.goals,",
    "  opening_hint = excluded.opening_hint, min_level = excluded.min_level, position = excluded.position;",
    "commit;",
    "",
  ].join("\n");
}
