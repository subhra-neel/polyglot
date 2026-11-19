import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROOT, asUser, createTestDb } from "./helpers/db.mjs";

const A = "55555555-5555-5555-5555-555555555555";
const B = "66666666-6666-6666-6666-666666666666";
let db: PGlite;
let sentences: string[];

const call = async <T>(user: string | null, query: string, params: unknown[] = []) =>
  asUser(db, user, async () => (await db.query<{ result: T }>(`select ${query} as result`, params)).rows[0].result);

beforeAll(async () => {
  db = await createTestDb(
    readFileSync(join(ROOT, "supabase", "content.sql"), "utf8"),
    `insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com');`,
  );
  const { rows } = await db.query<{ id: string }>(
    `select s.id from public.sentences s join public.lessons le on le.id = s.lesson_id
       join public.units u on u.id = le.unit_id where u.slug = 'i-want' order by le.position, s.position limit 3`,
  );
  sentences = rows.map((r) => r.id);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("unit checks", () => {
  it("saves a check and sends missed sentences back to revision, due now", async () => {
    const result = await call<{ back_to_revision: number }>(
      A,
      "public.record_unit_check('i-want', 6, 8, $1::uuid[])",
      [[sentences[0], sentences[1]]],
    );
    expect(result.back_to_revision).toBe(2);
    const due = await asUser(db, A, async () =>
      (await db.query<{ n: number }>("select count(*)::int as n from public.review_cards where due <= now()")).rows[0].n,
    );
    expect(due).toBe(2);
  });

  it("ignores missed sentences that belong to another unit", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select s.id from public.sentences s join public.lessons le on le.id = s.lesson_id join public.units u on u.id = le.unit_id where u.slug = 'greetings' limit 1",
    );
    const r = await call<{ back_to_revision: number }>(A, "public.record_unit_check('i-want', 8, 8, $1::uuid[])", [[rows[0].id]]);
    expect(r.back_to_revision).toBe(0);
  });

  it("refuses an unknown unit or an impossible score", async () => {
    await expect(call(A, "public.record_unit_check('nope', 1, 2)")).rejects.toThrow(/unknown unit/);
    await expect(call(A, "public.record_unit_check('i-want', 9, 8)")).rejects.toThrow(/check constraint/);
  });

  it("summarises weak spots: latest score, best, attempts, and tutor mistakes", async () => {
    await call(A, "public.record_mistakes('kn', array['wrong_case_ending'], '{\"said\":\"nanu beku\"}'::jsonb)");
    await call(A, "public.record_unit_check('greetings', 3, 8)");
    const spots = await call<{
      units: { slug: string; last_pct: number; best_pct: number; attempts: number }[];
      mistakes: { tag: string }[];
    }>(A, "public.get_weak_spots('kn')");
    expect(spots.units.map((u) => u.slug)).toEqual(["greetings", "i-want"]);
    expect(spots.units[0]).toMatchObject({ last_pct: 38, best_pct: 38, attempts: 1 });
    expect(spots.units[1]).toMatchObject({ last_pct: 100, best_pct: 100, attempts: 2 });
    expect(spots.mistakes.map((m) => m.tag)).toEqual(["wrong_case_ending"]);
  });

  it("keeps each learner's results private", async () => {
    const spots = await call<{ units: unknown[]; mistakes: unknown[] }>(B, "public.get_weak_spots('kn')");
    expect(spots).toEqual({ units: [], mistakes: [] });
    await expect(call(null, "public.get_weak_spots('kn')")).rejects.toThrow(/permission denied/);
  });
});
