# Polyglot

Learn to speak Kannada through real sentences and conversation. Spoken
Bengaluru Kannada, written in English letters, with English as the medium.
Tamil and Telugu follow once Kannada works well.

This is a private pilot for one learner, designed so it can become a
commercial product later.

## Status

Phase 2, milestone 1: project skeleton, sign-in and database schema.
See [docs/CHANGELOG.md](docs/CHANGELOG.md) for what is done and what is next.

## Stack

- Next.js (App Router, TypeScript) and Tailwind CSS, installable on Android as a web app
- Supabase: Postgres, sign-in, row-level security
- Vercel hosting
- Vitest for tests; the database schema is tested against a real Postgres engine

## Getting it running

Follow [docs/SETUP.md](docs/SETUP.md). In short: run the SQL migration in
Supabase, make sure Vercel has the two Supabase settings, deploy.

## Working on the code

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev                  # http://localhost:3000

npm run typecheck
npm run lint
npm test                     # unit tests + database schema tests
npm run build
```

End-to-end smoke test on a phone-sized screen (needs Playwright with Chromium):

```bash
# 1. With no Supabase settings
npm run build && npx next start -p 3100 &
node tests/e2e/smoke.mjs unconfigured

# 2. Against the built-in stand-in for Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-key \
  sh -c 'npm run build && npx next start -p 3100 &'
node tests/e2e/smoke.mjs configured
```

## Layout

```
src/app/            pages: welcome, sign-in, and the five tabs under (app)/
src/components/     shared interface pieces
src/lib/            settings, routes, sign-in helpers, Supabase client
src/proxy.ts        keeps sessions fresh and guards the signed-in pages
supabase/migrations database schema
tests/              unit, schema and end-to-end tests
docs/               setup guide and changelog
```
