/**
 * Revision and progress functions (0003_revision.sql) on a real Postgres
 * engine, with Unit 1 loaded and a learner who has finished lesson 1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schedule, type StoredCard } from "@/lib/srs";
import { ROOT, asUser, createTestDb } from "./helpers/db.mjs";

const LEARNER = "55555555-5555-5555-5555-555555555555";
const OTHER = "66666666-6666-6666-6666-666666666666";

let db: PGlite;

const call = async <T>(user: string | null, query: string, params: unknown[] = []) =>
  asUser(db, user, async () => (await db.query<{ result: T }>(`select ${query} as result`, params)).rows[0].result);

type QueueCard = StoredCard & { sentence: { roman: string; meaning: string } };

beforeAll(async () => {
  db = await createTestDb(
    readFileSync(join(ROOT, "supabase", "content.sql"), "utf8"),
    `insert into auth.users (id, email) values ('${LEARNER}', 'l@example.com'), ('${OTHER}', 'o@example.com');`,
  );
  await call(LEARNER, "public.complete_lesson('greetings', 'hello-how-are-you')");
}, 60_000);

afterAll(async () => {
  await db.close();
});

async function review(card: QueueCard, answer: "again" | "good") {
  const next = schedule(card, answer);
  await call(
    LEARNER,
    "public.record_review($1, $2::smallint, $3, $4, $5, $6, $7, $8, $9, $10, $11::smallint)",
    [card.id, next.rating, next.due.toISOString(), next.stability, next.difficulty, next.elapsed_days,
      next.scheduled_days, next.learning_steps, next.reps, next.lapses, next.state],
  );
}

describe("revision", () => {
  it("queues the finished lesson's sentences, due now", async () => {
    const queue = await call<QueueCard[]>(LEARNER, "public.get_review_queue(20)");
    expect(queue).toHaveLength(6);
    expect(queue[0].sentence.roman).toBeTruthy();
    expect(queue[0].state).toBe(0);
  });

  it("keeps another learner's queue empty", async () => {
    expect(await call<QueueCard[]>(OTHER, "public.get_review_queue(20)")).toEqual([]);
  });

  it("stores a review, logs it, and takes the card out of the due queue", async () => {
    const [first] = await call<QueueCard[]>(LEARNER, "public.get_review_queue(20)");
    await review(first, "good");

    const queue = await call<QueueCard[]>(LEARNER, "public.get_review_queue(20)");
    expect(queue.map((c) => c.id)).not.toContain(first.id);
    const stored = await call<QueueCard>(LEARNER, "public.get_review_card($1)", [first.id]);
    expect(stored.reps).toBe(1);
    expect(new Date(stored.due).getTime()).toBeGreaterThan(Date.now());

    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.review_logs");
    expect(rows[0].n).toBe(1);
  });

  it("refuses to review someone else's card", async () => {
    const [card] = await call<QueueCard[]>(LEARNER, "public.get_review_queue(20)");
    await expect(
      call(OTHER, "public.record_review($1, 3::smallint, now(), 1, 5, 0, 0, 0, 1, 0, 1::smallint)", [card.id]),
    ).rejects.toThrow(/card not found/);
    expect(await call(OTHER, "public.get_review_card($1)", [card.id])).toBeNull();
  });

  it("refuses an invalid rating", async () => {
    const [card] = await call<QueueCard[]>(LEARNER, "public.get_review_queue(20)");
    await expect(
      call(LEARNER, "public.record_review($1, 7::smallint, now(), 1, 5, 0, 0, 0, 1, 0, 1::smallint)", [card.id]),
    ).rejects.toThrow(/rating/);
  });
});

describe("progress", () => {
  it("reports what the learner has done", async () => {
    const progress = await call<Record<string, unknown>>(LEARNER, "public.get_progress('kn')");
    expect(progress).toMatchObject({
      daily_review_goal: 20,
      show_english: true,
      show_script: false,
      due_now: 5,
      reviewed_today: 1,
      sentences_started: 6,
      sentences_retained: 0,
      reviews_30d: 1,
      recall_rate_30d: 100,
      lessons_completed: 1,
      flags_open: 0,
    });
    expect(progress.next_lesson).toMatchObject({ unit_slug: "greetings", lesson_slug: "thanks-sorry-goodbye" });
  });

  it("points a new learner at the first lesson", async () => {
    const progress = await call<Record<string, unknown>>(OTHER, "public.get_progress('kn')");
    expect(progress).toMatchObject({ due_now: 0, sentences_started: 0, recall_rate_30d: null, lessons_completed: 0 });
    expect(progress.next_lesson).toMatchObject({ lesson_slug: "hello-how-are-you" });
  });

  it("saves settings, keeping the review goal in range", async () => {
    await call(LEARNER, "public.update_settings(false, true, 900::smallint)");
    const progress = await call<Record<string, unknown>>(LEARNER, "public.get_progress('kn')");
    expect(progress).toMatchObject({ show_english: false, show_script: true, daily_review_goal: 500 });
    const other = await call<Record<string, unknown>>(OTHER, "public.get_progress('kn')");
    expect(other).toMatchObject({ show_english: true, show_script: false });
  });

  it("refuses signed-out visitors", async () => {
    await expect(call(null, "public.get_review_queue(20)")).rejects.toThrow(/permission denied/);
    await expect(call(null, "public.get_progress('kn')")).rejects.toThrow(/permission denied/);
  });
});
