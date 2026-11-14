# Changelog and task tracker

The full plan lives in the Claude doc "Polyglot — Phase 1 architecture and
Kannada MVP plan". This file records what has actually been built and tested.

## 2026-11-14 — Phase 2, milestone 1: skeleton, sign-in, database schema

### Built
- Next.js 16 app (TypeScript, Tailwind 4), installable as a web app (manifest, icons).
- Welcome page; sign-in page with email and password (sign in / create account).
- Five-tab shell: Today, Learn, Talk (centre microphone button), Build, Me.
  Learn reads the Level 1 units from the database. Me shows the account and signs out.
  Talk, Build and parts of Today and Me are labelled placeholders for later milestones.
- Session handling in `src/proxy.ts`: refreshes sessions, sends signed-out
  visitors to sign-in (remembering the page they wanted), sends signed-in
  learners past the welcome and sign-in pages.
- App starts without Supabase settings and explains what is missing.
- Database schema `supabase/migrations/0001_init.sql`: 17 content tables,
  11 learner tables, events; row-level security on every table; trigger that
  gives each new account a profile and a Kannada enrolment; seed of languages,
  five Kannada levels and eight Level 1 units.

### Decisions made while building
- Sign-in is email + password only. Google sign-in was in the plan; it needs a
  Google Cloud project, so it waits until it is wanted.
- Kept Next.js Cache Components on (the framework default, and mandatory in
  the next major version). Pages that read the session do so inside Suspense.
- Validation statuses in the schema: `draft`, `source_checked`,
  `native_verified`. Row-level security hides `draft` sentences from learners.
- Spoken-only: `text_roman` is the required field on sentences; `text_script`
  is optional and `profiles.show_script` defaults to off.
- No per-sentence literal-translation column: the word-by-word tokens cover it.

### Tested
- `npm run typecheck`, `npm run lint`, `npm run build`: clean.
- `npm test`: 24 tests. 14 run the real migration on a real Postgres engine
  (PGlite) and check the seed, the new-user trigger and row-level security
  (own rows only, drafts hidden, learners cannot write content, signed-out
  visitors see nothing, account deletion removes learner data).
- `tests/e2e/smoke.mjs` on a Pixel 7-sized screen, both modes passing:
  redirects, setup notice, wrong-password error, account creation, all five
  tabs, session surviving a reload, sign-out, sign back in, no sideways
  scrolling, no browser or server errors.

### Not tested
- Against the real Supabase project or the real Vercel deployment. Sign-in was
  exercised against a stand-in server (`tests/e2e/mock-supabase.mjs`) that
  returns Supabase's documented responses. First real proof is step 4 of
  `docs/SETUP.md`.
- The email-confirmation link route (`/auth/confirm`) has no automated test.
- iPhone Safari.

### Known gaps
- No "forgot password" yet.
- The smoke test is not wired into `npm test` (it needs a browser and a running server).
- `npm audit` reports 8 moderate findings, all inside the linting toolchain
  (development only, not shipped to users).

### Next — milestone 2: content pipeline
- Unit 1 written as YAML, schema-validated, loaded into the database.
- Sentence cards with audio at two speeds.
- Needs from the owner: nothing new until audio (a Google Cloud or Sarvam key).

### Pending owner actions
- Run the SQL migration, check the Vercel settings, try the app (`docs/SETUP.md`).

### Open questions
- Alar dictionary licence terms for reuse.
- Whether Azure pronunciation scoring covers Kannada (matters in phase 4).
