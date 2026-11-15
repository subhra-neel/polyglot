/**
 * Runs the real migrations against a real Postgres engine (PGlite, Postgres
 * compiled to WebAssembly) and checks the behaviour the app depends on:
 * the seed, the new-user trigger and row-level security.
 *
 * Supabase provides the `auth` schema and the `authenticated` role; the
 * helper creates a small stand-in so the migrations run unchanged.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser as runAs, createTestDb } from "./helpers/db.mjs";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

let db: PGlite;

const asUser = <T>(userId: string, fn: () => Promise<T>) => runAs(db, userId, fn);

beforeAll(async () => {
  db = await createTestDb(`
    insert into auth.users (id, email) values
      ('${ALICE}', 'alice@example.com'),
      ('${BOB}', 'bob@example.com');
  `);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("seed", () => {
  it("makes Kannada the only live language", async () => {
    const { rows } = await db.query<{ code: string; status: string }>(
      "select code, status from public.languages order by position",
    );
    expect(rows).toEqual([
      { code: "kn", status: "live" },
      { code: "ta", status: "hidden" },
      { code: "te", status: "hidden" },
    ]);
  });

  it("creates five Kannada levels and eight Level 1 units", async () => {
    const levels = await db.query<{ n: number }>(
      "select count(*)::int as n from public.levels where language_code = 'kn'",
    );
    const units = await db.query<{ n: number }>(
      `select count(*)::int as n from public.units u
         join public.levels l on l.id = u.level_id
        where l.language_code = 'kn' and l.number = 1`,
    );
    expect(levels.rows[0].n).toBe(5);
    expect(units.rows[0].n).toBe(8);
  });
});

describe("new-user trigger", () => {
  it("creates a profile with spoken-only defaults", async () => {
    const { rows } = await db.query<{
      display_name: string;
      show_script: boolean;
      show_english: boolean;
    }>("select display_name, show_script, show_english from public.profiles where id = $1", [ALICE]);
    expect(rows).toEqual([{ display_name: "alice", show_script: false, show_english: true }]);
  });

  it("enrols the learner in live languages only", async () => {
    const { rows } = await db.query<{ language_code: string; level_number: number }>(
      "select language_code, level_number from public.enrollments where user_id = $1",
      [ALICE],
    );
    expect(rows).toEqual([{ language_code: "kn", level_number: 1 }]);
  });
});

describe("row-level security", () => {
  it("is switched on for every table in the public schema", async () => {
    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
    );
    expect(rows).toEqual([]);
  });

  it("lets a learner read only their own profile", async () => {
    const rows = await asUser(ALICE, async () => {
      const result = await db.query<{ id: string }>("select id from public.profiles");
      return result.rows;
    });
    expect(rows).toEqual([{ id: ALICE }]);
  });

  it("stops a learner updating someone else's profile", async () => {
    await asUser(ALICE, async () => {
      await db.query("update public.profiles set display_name = 'hacked' where id = $1", [BOB]);
    });
    const { rows } = await db.query<{ display_name: string }>(
      "select display_name from public.profiles where id = $1",
      [BOB],
    );
    expect(rows[0].display_name).toBe("bob");
  });

  it("keeps one learner's conversations private from another", async () => {
    await asUser(ALICE, async () => {
      await db.query("insert into public.conversations (user_id, language_code) values ($1, 'kn')", [ALICE]);
    });
    const seenByBob = await asUser(BOB, async () => {
      const result = await db.query("select id from public.conversations");
      return result.rows;
    });
    const seenByAlice = await asUser(ALICE, async () => {
      const result = await db.query("select id from public.conversations");
      return result.rows;
    });
    expect(seenByBob).toHaveLength(0);
    expect(seenByAlice).toHaveLength(1);
  });

  it("refuses rows written in another learner's name", async () => {
    await expect(
      asUser(ALICE, async () => {
        await db.query("insert into public.conversations (user_id, language_code) values ($1, 'kn')", [BOB]);
      }),
    ).rejects.toThrow(/row-level security/);
  });

  it("hides draft sentences from learners and shows checked ones", async () => {
    await db.exec(`
      insert into public.sentences (language_code, text_roman, meaning_en, validation_status) values
        ('kn', 'draft sentence',   'not yet checked', 'draft'),
        ('kn', 'checked sentence', 'checked',         'source_checked');
    `);
    const rows = await asUser(ALICE, async () => {
      const result = await db.query<{ text_roman: string }>("select text_roman from public.sentences");
      return result.rows;
    });
    expect(rows).toEqual([{ text_roman: "checked sentence" }]);
  });

  it("stops learners writing content", async () => {
    await expect(
      asUser(ALICE, async () => {
        await db.query(
          "insert into public.sentences (language_code, text_roman, meaning_en) values ('kn', 'x', 'y')",
        );
      }),
    ).rejects.toThrow(/row-level security/);
  });

  it("shows nothing to visitors who are not signed in", async () => {
    const rows = await runAs(db, null, async () => (await db.query("select code from public.languages")).rows);
    expect(rows).toHaveLength(0);
  });
});

describe("data rules", () => {
  it("requires a review card to point at exactly one thing", async () => {
    await expect(
      db.query("insert into public.review_cards (user_id) values ($1)", [ALICE]),
    ).rejects.toThrow(/check constraint/);
  });

  it("removes a learner's data when their account is deleted", async () => {
    await db.query("delete from auth.users where id = $1", [BOB]);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.profiles where id = $1",
      [BOB],
    );
    expect(rows[0].n).toBe(0);
  });
});
