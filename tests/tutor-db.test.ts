import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROOT, asUser, createTestDb } from "./helpers/db.mjs";

const A = "77777777-7777-7777-7777-777777777777";
const B = "88888888-8888-8888-8888-888888888888";
let db: PGlite;

const call = async <T>(user: string | null, query: string, params: unknown[] = []) =>
  asUser(db, user, async () => (await db.query<{ result: T }>(`select ${query} as result`, params)).rows[0].result);

beforeAll(async () => {
  db = await createTestDb(
    readFileSync(join(ROOT, "supabase", "content.sql"), "utf8"),
    `insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com');`,
  );
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("tutor conversations", () => {
  let id: string;

  it("lists the scenes from content/kn/scenes.yaml in order, with their Try phrases", async () => {
    const list = await call<{ slug: string; opening_hint: string }[]>(A, "public.get_scenarios('kn')");
    expect(list.map((s) => s.slug)).toEqual([
      "new-neighbour",
      "tea-stall",
      "auto-ride",
      "vegetable-market",
      "guiding-the-auto",
      "darshini",
      "plumber-call",
    ]);
    expect(list[3].opening_hint).toBe("Try: idakke eshTu? · svalpa kammi māDi · plāsTik byāg bēDa");
  });

  it("starts a conversation and stores messages in order", async () => {
    id = await call<string>(A, "public.start_conversation('tea-stall')");
    await call(A, "public.add_message($1, 'tutor', 'ēnu bēku?', 'ಏನು ಬೇಕು?', 'What do you want?')", [id]);
    await call(A, "public.add_message($1, 'learner', 'nānu kāfi bēku', null, null, $2::jsonb)", [
      id,
      JSON.stringify({ category: "error", tags: ["wrong_case_ending"] }),
    ]);
    const convo = await call<{ scenario: { slug: string }; messages: { role: string; roman: string }[] }>(
      A,
      "public.get_conversation($1)",
      [id],
    );
    expect(convo.scenario.slug).toBe("tea-stall");
    expect(convo.messages.map((m) => m.role)).toEqual(["tutor", "learner"]);
  });

  it("keeps conversations private", async () => {
    expect(await call(B, "public.get_conversation($1)", [id])).toBeNull();
    await expect(call(B, "public.add_message($1, 'learner', 'hi')", [id])).rejects.toThrow(/conversation not found/);
    expect(await call<unknown[]>(B, "public.list_conversations(10)")).toEqual([]);
  });

  it("lists the learner's conversations with corrections counted", async () => {
    const list = await call<{ title: string; turns: number; corrections: number }[]>(A, "public.list_conversations(10)");
    expect(list[0]).toMatchObject({ title: "At a tea stall", turns: 1, corrections: 1 });
  });

  it("counts recurring mistakes and keeps the five latest examples", async () => {
    for (let i = 0; i < 7; i++) {
      await call(A, "public.record_mistakes('kn', $1, $2::jsonb)", [
        ["wrong_case_ending", "Bad Tag!"],
        JSON.stringify({ said: `try ${i}` }),
      ]);
    }
    const ctx = await call<{ level: number; mistakes: { tag: string; occurrences: number; example: { said: string } }[] }>(
      A,
      "public.get_tutor_context('kn')",
    );
    expect(ctx.level).toBe(1);
    expect(ctx.mistakes).toEqual([{ tag: "wrong_case_ending", occurrences: 7, example: { said: "try 6" } }]);
    const { rows } = await db.query<{ n: number }>(
      "select jsonb_array_length(examples) as n from public.error_patterns where tag = 'wrong_case_ending'",
    );
    expect(rows[0].n).toBe(5);
  });

  it("ends a conversation once", async () => {
    await call(A, "public.end_conversation($1)", [id]);
    const first = await call<{ ended_at: string }>(A, "public.get_conversation($1)", [id]);
    await call(A, "public.end_conversation($1)", [id]);
    const second = await call<{ ended_at: string }>(A, "public.get_conversation($1)", [id]);
    expect(first.ended_at).toBeTruthy();
    expect(second.ended_at).toBe(first.ended_at);
  });

  it("refuses signed-out visitors", async () => {
    await expect(call(null, "public.get_scenarios('kn')")).rejects.toThrow(/permission denied/);
  });
});
