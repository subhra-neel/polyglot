/**
 * A real Postgres engine (PGlite) with a small stand-in for the parts of
 * Supabase the migrations rely on: the auth schema, auth.uid(), and the
 * anon / authenticated roles. Shared by the schema tests, the content tests
 * and the end-to-end stand-in server.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const SUPABASE_STAND_IN = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

/** A fresh database with every migration applied, plus optional extra SQL. */
export async function createTestDb(...extraSql) {
  const db = new PGlite();
  await db.exec(SUPABASE_STAND_IN);
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  for (const sql of extraSql) await db.exec(sql);
  return db;
}

/** Run `fn` as a signed-in learner (or as `anon` when userId is null). */
export async function asUser(db, userId, fn) {
  if (userId) {
    await db.exec(`set request.jwt.claim.sub = '${userId}'; set role authenticated;`);
  } else {
    await db.exec(`set role anon;`);
  }
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; reset request.jwt.claim.sub;`);
  }
}
