/**
 * The content pipeline: romanisation check, file validation, and the
 * generated SQL loaded into a real Postgres engine and read back through
 * the same database functions the app calls.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkUnit, loadContentDir, sentenceUuid, stableUuid, unitsToSql } from "../content-pipeline/build.ts";
import { loadScenes, scenesToSql } from "../content-pipeline/scenes";
import { normaliseRoman, romanise } from "../content-pipeline/romanise.ts";
import { ROOT, asUser, createTestDb } from "./helpers/db.mjs";

const LEARNER = "33333333-3333-3333-3333-333333333333";
const OTHER = "44444444-4444-4444-4444-444444444444";

describe("romanise", () => {
  it.each([
    ["ನಮಸ್ಕಾರ", "namaskāra"],
    ["ಹೇಗಿದ್ದೀರಾ?", "hēgiddīrā?"],
    ["ಊಟ ಆಯ್ತಾ?", "ūTa āytā?"],
    ["ಧನ್ಯವಾದಗಳು", "dhanyavādagaLu"],
    ["ತುಂಬಾ", "tumbā"],
    ["ಕ್ಷಮಿಸಿ", "kshamisi"],
    ["ದಯವಿಟ್ಟು", "dayaviTTu"],
    ["ಸಿಗೋಣ", "sigōNa"],
    ["ಬೆಂಗಳೂರು", "bengaLūru"],
  ])("%s → %s", (script, roman) => {
    expect(romanise(script)).toBe(roman);
  });

  it("treats f and ph as the same letter, as Kannada writes both with ಫ", () => {
    expect(normaliseRoman(romanise("ಕಾಫಿ"))).toBe(normaliseRoman("kāfi"));
  });

  it("refuses a Kannada character it does not know", () => {
    expect(() => romanise("ೱ")).toThrow(/No romanisation/);
  });
});

describe("checkUnit", () => {
  const sentence = (overrides: Record<string, unknown> = {}) => ({
    id: "hello",
    roman: "namaskāra",
    script: "ನಮಸ್ಕಾರ",
    meaning: "Hello",
    why: "Because.",
    status: "source_checked",
    sources: ["Test"],
    tokens: [{ word: "namaskāra", gloss: "hello" }],
    ...overrides,
  });
  const unit = (sentences: unknown[]) => ({
    language: "kn",
    level: 1,
    unit: "greetings",
    lessons: [{ slug: "one", title: "One", sentences }],
  });
  const messages = (data: unknown) => checkUnit("test.yaml", data).problems.map((p) => p.message);

  it("accepts a correct file", () => {
    expect(messages(unit([sentence()]))).toEqual([]);
  });

  it("catches a typo in the English-letter form", () => {
    expect(messages(unit([sentence({ roman: "namaskara" })]))[0]).toMatch(/does not match script/);
  });

  it("catches a typo in the script", () => {
    expect(messages(unit([sentence({ script: "ನಮಸ್ಕರ" })]))[0]).toMatch(/does not match script/);
  });

  it("catches words that do not add up to the sentence", () => {
    expect(messages(unit([sentence({ tokens: [{ word: "nama", gloss: "x" }] })]))[0]).toMatch(/do not add up/);
  });

  it("refuses a checked sentence with no source", () => {
    expect(messages(unit([sentence({ sources: [] })]))[0]).toMatch(/at least one source/);
  });

  it("allows a draft with no source", () => {
    expect(messages(unit([sentence({ status: "draft", sources: [] })]))).toEqual([]);
  });

  it("catches a variant that points nowhere", () => {
    expect(messages(unit([sentence({ variants: [{ relation: "casual", sentence: "missing" }] })]))[0]).toMatch(
      /does not exist/,
    );
  });

  it("catches the same id used twice", () => {
    expect(messages(unit([sentence(), sentence()]))).toContain("id is used twice");
  });
});

describe("stableUuid", () => {
  it("gives the same id every time and a valid version-5 layout", () => {
    expect(stableUuid("x")).toBe(stableUuid("x"));
    expect(stableUuid("x")).not.toBe(stableUuid("y"));
    expect(stableUuid("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("Kannada content files", () => {
  const { units, problems } = loadContentDir(join(ROOT, "content", "kn"));

  it("have no problems", () => {
    expect(problems).toEqual([]);
  });

  it("match the committed supabase/content.sql (run `npm run content:build`)", () => {
    const { file: scenes } = loadScenes(join(ROOT, "content", "kn", "scenes.yaml"));
    expect(readFileSync(join(ROOT, "supabase", "content.sql"), "utf8")).toBe(unitsToSql(units) + "\n" + scenesToSql(scenes!));
  });
});

describe("loaded into the database", () => {
  const { units } = loadContentDir(join(ROOT, "content", "kn"));
  const sql = unitsToSql(units);
  const unit = units.find((u) => u.unit === "greetings")!;
  const lesson1 = unit.lessons[0];
  const shownInLesson1 = lesson1.sentences.filter((s) => s.status !== "draft");
  let db: PGlite;

  const call = async <T>(user: string | null, query: string, params: unknown[] = []) =>
    asUser(db, user, async () => (await db.query<{ result: T }>(`select ${query} as result`, params)).rows[0].result);

  beforeAll(async () => {
    db = await createTestDb(
      sql,
      `insert into auth.users (id, email) values ('${LEARNER}', 'l@example.com'), ('${OTHER}', 'o@example.com');`,
    );
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it("lists all eight Level 1 units with their lessons", async () => {
    const list = await call<{ slug: string; lesson_count: number }[]>(LEARNER, "public.get_units('kn', 1::smallint)");
    expect(list).toHaveLength(8);
    expect(list[0]).toMatchObject({ slug: "greetings", lesson_count: unit.lessons.length, completed_count: 0 });
    expect(list[1]).toMatchObject({ slug: "who-i-am", lesson_count: 2 });
    expect(list[2]).toMatchObject({ slug: "this-and-that", lesson_count: 2 });
    expect(list[3]).toMatchObject({ slug: "i-want", lesson_count: 2 });
    expect(list[4]).toMatchObject({ slug: "is-there", lesson_count: 2 });
    expect(list.slice(5).map((u) => [u.slug, u.lesson_count])).toEqual([
      ["numbers-money", 2],
      ["polite-requests", 2],
      ["repair", 2],
    ]);
  });

  it("returns a lesson with checked sentences only, in order", async () => {
    const lesson = await call<{ sentences: { roman: string; status: string }[] }>(
      LEARNER,
      "public.get_lesson('greetings', $1)",
      [lesson1.slug],
    );
    expect(lesson.sentences.map((s) => s.roman)).toEqual(shownInLesson1.map((s) => s.roman));
    expect(lesson.sentences.every((s) => s.status !== "draft")).toBe(true);
  });

  it("includes word-by-word meanings and variants", async () => {
    const lesson = await call<{
      sentences: { roman: string; tokens: { word: string; breakdown: string | null }[]; variants: { relation: string; roman: string }[] }[];
    }>(LEARNER, "public.get_lesson('greetings', $1)", [lesson1.slug]);
    const howAreYou = lesson.sentences.find((s) => s.roman === "hēgiddīrā?")!;
    expect(howAreYou.tokens[0].breakdown).toMatch(/hēge \(how\)/);
    expect(howAreYou.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relation: "casual", roman: "hēgiddīyā?" }),
        expect.objectContaining({ relation: "alternative", roman: "hēgiddīri?" }),
      ]),
    );
  });

  it("returns null for a lesson that does not exist", async () => {
    expect(await call(LEARNER, "public.get_lesson('greetings', 'nope')")).toBeNull();
  });

  it("completes a lesson once, queuing its sentences for revision", async () => {
    expect(await call<number>(LEARNER, "public.complete_lesson('greetings', $1)", [lesson1.slug])).toBe(
      shownInLesson1.length,
    );
    expect(await call<number>(LEARNER, "public.complete_lesson('greetings', $1)", [lesson1.slug])).toBe(0);

    const unitView = await call<{ lessons: { completed: boolean }[] }>(LEARNER, "public.get_unit('greetings')");
    expect(unitView.lessons.map((l) => l.completed)).toEqual([true, false]);

    const otherView = await call<{ lessons: { completed: boolean }[] }>(OTHER, "public.get_unit('greetings')");
    expect(otherView.lessons.map((l) => l.completed)).toEqual([false, false]);
  });

  it("keeps a learner's revision queue when the content is loaded again", async () => {
    await db.exec(sql);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.review_cards where user_id = $1",
      [LEARNER],
    );
    expect(rows[0].n).toBe(shownInLesson1.length);
  });

  it("records a flagged sentence for the learner who flagged it", async () => {
    const id = sentenceUuid("kn", "hello");
    await call(LEARNER, "public.flag_sentence($1, $2)", [id, "  I heard namaskāra with a short a  "]);
    const { rows } = await db.query<{ user_id: string; note: string }>("select user_id, note from public.sentence_flags");
    expect(rows).toEqual([{ user_id: LEARNER, note: "I heard namaskāra with a short a" }]);
  });

  it("will not flag a draft sentence the learner cannot see", async () => {
    const draft = sentenceUuid("kn", "yes-eaten");
    await expect(call(LEARNER, "public.flag_sentence($1)", [draft])).rejects.toThrow(/sentence not found/);
  });

  it("refuses signed-out visitors", async () => {
    await expect(call(null, "public.get_lesson('greetings', $1)", [lesson1.slug])).rejects.toThrow(/permission denied/);
    await expect(call(null, "public.complete_lesson('greetings', $1)", [lesson1.slug])).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("tutor scenes", () => {
  it("check each Try phrase against its Kannada script", () => {
    const { problems } = loadScenes(join(ROOT, "content", "kn", "scenes.yaml"));
    expect(problems).toEqual([]);
  });
});
