# Changelog and task tracker

The full plan lives in the Claude doc "Polyglot — Phase 1 architecture and
Kannada MVP plan". This file records what has actually been built and tested.

## 2026-11-18 — Say it (listen and repeat); chat layout fix

### Built
- "Say it" on every lesson sentence: the learner records themselves, Sarvam
  speech-to-text (mode `transcribe`, so loanwords come back in Kannada too)
  writes down what it heard, and each word of the sentence is marked heard
  (green) or missed (red, dotted). Verdicts: Clear / Nearly / Not quite.
  Matching (`src/lib/speech-match.ts`) ignores accents, aspiration and
  doubled letters, allows about one sound in four to differ in long words,
  and requires an exact match for short words (alla/illa, bēku/bēDa).
  Labelled honestly as a rough guide, not a pronunciation score.
- Recording shared by the tutor's mic and Say it (`src/lib/use-recorder.ts`);
  `/api/stt?for=practice` selects transcribe mode.
- Chat: the reply area now sits flush on the tab bar with its own
  background, and "Finish conversation" moved inside it (fixes the gap
  where messages showed through).

### Tested
- 7 new unit tests for word matching (125 total); smoke test records with a
  fake microphone on a lesson card and checks the verdict and mode.
- NOT tested against real Sarvam speech-to-text.

## 2026-11-18 — Four new tutor scenes; voice input

### Built
- Tutor scenes now live in `content/kn/scenes.yaml` and are written into
  `supabase/content.sql` (no separate migration). Each "Try" phrase with a
  script is checked letter for letter.
- New scenes using Units 4–8: Bargaining at the vegetable market
  (Shivamma), Guiding the auto home (Suresh), Ordering at a darshini
  (Prakash), Calling the plumber (Venkatesh, phone call that needs
  "matte hēLi" / "svalpa nidhānavāgi mātāDi"). 7 scenes in all.
- Voice input in the tutor: tap the mic beside the reply box, speak, tap ■.
  Sarvam speech-to-text (`saaras:v3`, mode `codemix`, `kn-IN`) turns it into
  text; Kannada is shown in the app's English letters, English words stay
  English, and the learner can edit before sending. Max 25 s. Records
  WebM/Opus on Android, MP4/AAC on iPhone. `/api/stt` is signed-in only.
  Optional env: `SARVAM_STT_MODEL`, `SARVAM_STT_MODE`.

### Tested
- 118 unit tests; smoke test records from a fake microphone, checks the
  request (model, mode, language, file) and the text in the box, and that
  /api/stt refuses visitors and non-audio.
- NOT tested against real Sarvam speech-to-text (this workspace cannot
  reach it): check on a phone.

## 2026-11-17 — Tutor self-test on live Sarvam: 14 of 14

- Owner ran the self-test on production: all 8 mistakes caught (including
  the owner's own two) and all 6 spoken forms accepted. Decision: keep
  Sarvam `sarvam-105b-conversations` for checking and replies.
- Tidy-up: a "valid variant" whose correction is just the learner's own
  words is shown as plain ✓ Correct; stray verdict words at the start of an
  explanation are dropped; checker told to use "none" when the learner
  already used the standard words.

## 2026-11-17 — Tutor: separate checking step, ✓ Correct, Unclear, self-test

### Why
- First real conversation (owner, lift scene): "namaskara chennagide" (should
  be chennāgiddīni: -ide is "it", -īni is "I") and "uta martara" (not
  Kannada) both passed with no correction; Lakshmi misspelled
  chennāgiddīrā and ended the scene after three replies.

### Built
- Checking is now its own model call, before the character replies
  (`src/lib/tutor/check.ts`): a teacher prompt with Level 1 rules (person
  endings, nanage with bēku/gottu, alla vs illa, my/your), spoken forms to
  accept, and worked examples including the owner's two lines. Medium
  reasoning effort, low temperature.
- New verdict "unclear": shows a best guess and a sentence to try; the
  character asks again in the scene instead of moving on.
- Every checked line now shows ✓ Correct when accepted.
- Reply prompt: no goodbye before the goals are met and 6 learner replies;
  standard spelling; never corrects (the checker does that).
- Tutor self-test (Tutor → "Check the tutor's accuracy"): runs 14 known
  lines (8 mistakes to catch, 6 spoken forms to accept) through the live
  checker and shows each verdict. This is how the real Sarvam model is
  measured, since this workspace cannot reach Sarvam.

### Tested
- 115 unit tests; smoke test covers ✓ Correct, Unclear and the self-test.

## 2026-11-17 — Level 1 complete: Units 6, 7 and 8

### Built
- Unit 6 "Numbers, money, how much": one to ten; idakke eshTu?,
  eshTu āgutte?, 20 / 50 / 100 / 1000, svalpa kammi māDi. 17 sentences.
- Unit 7 "Come, go, give, stop": banni, illi banni, oLagaDe banni, nēra
  hōgi, nidhāna hōgi, alli nillisi; nīru koDi, bil koDi, mīTar hāki,
  svalpa vēT māDi, nāLe beLigge banni. 11 sentences.
- Unit 8 "I did not understand": nanage artha āgalilla, ēnu?, matte hēLi
  (innomme hēLi), svalpa nidhānavāgi mātāDi, kannaDa baralla; adara artha
  ēnu?, kannaDadalli … hēge hēLōdu?, nīvu inglish mātāDtīrā?. 8 sentences.
- Level 1 now: 8 units, 16 lessons, 93 sentences shown (+ alternatives).
- The tutor is easier to find: the mic button in the bottom bar is now
  labelled "Tutor", and Today has an "AI tutor" card.
- Picture used throughout Unit 7: the polite -i ending is "please" built
  into the verb (banni, hōgi, koDi, nillisi, hāki, hēLi).

### Sources
- SWALPA time-and-numbers, travel-and-conflict, logistics chapters;
  Preply; wikiHow "Speak in Kannada"; KannadaMaadi glossary; Multibhashi.

### Tested
- Content checker passes; unit tests; smoke test sees all eight units open.

## 2026-11-17 — Level 1, Units 4 and 5

### Built
- Unit 4 "I want, I do not want": nanage … bēku, nimage ēnu bēku?, bēkā?,
  bēDa, "no plastic bag". 8 sentences.
- Unit 5 "Is there, there is not; where": nīru ideyā? / ide / illa,
  Taim ideyā?, karenT hōgide, TāyleT ellide?, nimma mane ellide?, illide,
  allide, illi nillisi. 10 sentences.
- Pictures used in explanations: a parcel delivered "to me" (nanage), a
  switch (bēku/bēDa, ide/illa), near i / far a / question e (illi, alli, elli).
- Sentence lab: "Where is …? / It's here / It isn't here". 6 patterns,
  48 sentences.

### Sources
- SWALPA survival and everyday-logistics chapters; Penn Language Center
  Kannada lesson 3 (ide/illa, ellide?, illide/allide, the -ge "to" ending).

### Tested
- Content checker passes; unit tests; smoke test sees Units 1 to 5 open.

## 2026-11-16 — Level 1, Units 2 and 3

### Built
- Unit 2 "Who I am, who you are": What's your name? (name, "I'm …",
  introducing a friend) and Where are you from? Where do you work? (from,
  work, where are you right now). 11 sentences, 1 alternative.
- Unit 3 "This and that; yes and no": What is this? (idu/adu, the -ā
  question, haudu, alla) and Who is that? I don't know (ivaru/avaru, illa,
  gottu/gottilla, "I know a little Kannada"). 13 sentences, 1 alternative.
- Explanations use everyday pictures (a label on a jar for "no is"; wrong
  label vs empty shelf for alla vs illa; near i, far a).
- Sentence lab: new "I know … / I don't know …" pattern (Kannada, English,
  Hindi). 5 patterns, 36 sentences.

### Content decisions
- New source: Penn Language Center Kannada lesson 2 (idu/adu, -ā question,
  alla/illa), plus the Goethe-Verlag phrasebook for nanage gottilla.
- Spoken forms used where books differ: bandiddīni not bandiddēne,
  māDtīni not māDuttēne, kelsa not kelasa.
- Several sentences are built from a source's frame with words the sources
  attest (each file says which). Native check still needed before launch.

### Tested
- Content checker: every script matches its English-letter spelling.
  111 unit tests; smoke test opens Unit 3.

## 2026-11-15 — Phase 3, milestone 1: AI tutor (text roleplay)

### Built
- Talk tab: three Level 1 scenes (a new neighbour, a tea stall, an auto
  ride), each with a persona, a goal and "Try:" phrases.
- Chat: the tutor speaks in character in spoken Bengaluru Kannada. Its lines
  show in English letters (converted from script by the app, not the model),
  script if switched on, English on tap, and Play/Slow audio.
- Corrections on the learner's line: Correction (error), More natural,
  Formality, Also correct (valid regional or spoken forms are never counted
  as mistakes). Each shows what you said, the better version, what changed
  and why. English questions ("how do I say…") get a short answer.
- Recurring mistakes are tagged and stored; the next conversation's prompt
  includes them so the tutor watches for them.
- Finish shows the corrections to practise; past conversations are listed.
- Chat model behind a swappable connector (`src/lib/llm`); first one is
  Sarvam `sarvam-105b-conversations` with a strict JSON reply schema, read
  and checked by zod, retried once.
- `0004_tutor.sql`: scenes and conversation functions, all under row-level
  security.

### Tested
- 111 unit tests (reply parsing, corrections, prompt, connector, database
  functions). Smoke test: 42 steps against a stand-in chat model.

### Not yet verified
- Sarvam's real Kannada quality and JSON reliability: this workspace cannot
  reach Sarvam. Needs a check on the live app; the connector can be switched
  to another model if needed.

## 2026-11-15 — Phase 2, milestone 3: sentence lab

### Built
- Build tab: four patterns from `content/kn/patterns.yaml`: "I want / don't
  want" (nanage … bēku / bēDa), "there is / isn't / is there?" (… ide / illa /
  ideyā?), "please give" (… koDi), "how much?" (… eshTu?). 9 words, 30
  buildable sentences.
- Pattern page: choose a word and an ending, see the sentence (English
  letters, script if switched on, English) and hear it; "Your turn" gives an
  English sentence to build, checks it, and explains a wrong word or ending.
- `/api/audio/lab/<pattern>/<word>/<ending>/<speed>`: rebuilds the sentence
  from the checked pattern data before speaking, so only real lab sentences
  can use the voice credit.
- Content pipeline checks every buildable combination letter for letter,
  and writes `src/content/kn-patterns.json` for the app.

### Content decisions
- Patterns and words are attested in SWALPA (survival, logistics and social
  chapters). Each combination is grammatical by construction rather than
  individually attested.
- Left out until a source confirms them: nimage ("to you"), the question bēkā?.
- English loanwords (kāfi, Tī, bil, menu, help, karenT) are taught as used in
  Bengaluru. The checker treats f and ph as one letter because Kannada writes
  both with ಫ.
- Lab patterns are bundled with the app rather than stored in the database,
  so they need no SQL step. Practice results are not saved yet.

### Tested
- 91 unit and database tests; phone smoke test 36 steps including building,
  hearing, refusing an unbuildable sentence, and practice feedback.

## 2026-11-15 — Phase 2, milestone 4: revision, progress, settings

### Built
- Spaced repetition with FSRS (`ts-fsrs`, aiming for 90% recall). Finished
  lessons' sentences come back when due.
- `/review`: shows the English meaning, asks you to say the Kannada aloud,
  then reveals it with audio and four answers (Again, Hard, Good, Easy), each
  labelled with when the sentence would return. "Again" brings the sentence
  back once more in the same session.
- Today: revision first when anything is due, a daily review goal bar, and the
  next unfinished lesson.
- Me: sentences learning, known for a week or more, recall rate over 30 days,
  lessons finished, open flags; settings to hide English meanings (tap to
  reveal), show Kannada script, and set the daily review goal.
- `supabase/migrations/0003_revision.sql`: get_review_queue, get_review_card,
  record_review, get_progress, update_settings. "Today" is counted in the
  learner's time zone (default Asia/Kolkata).

### Tested
- 86 unit and database tests, including FSRS ordering (Again < Hard < Good <
  Easy), lapses, own-cards-only, invalid ratings, settings bounds.
- Phone smoke test: 34 steps, adding Today's due card, a full review session
  with a forgotten card returning, review logs, the goal bar, progress
  figures, and settings changing lesson cards.

## 2026-11-15 — Recorded audio with Sarvam

### Built
- Play and Slow now use Sarvam's Bulbul v3 voice (speaker `shubh`, changeable
  with `SARVAM_TTS_SPEAKER`). Slow is generated at pace 0.75, not stretched.
- `/api/audio/<sentence>/<normal|slow>`: generates a sentence's audio from its
  Kannada script on first play and returns it with a one-year cache. The
  address changes when the text or voice changes. Signed-out visitors, draft
  and unknown sentences are refused, so nobody else can spend the credit.
- The session proxy skips audio requests, so audio carries no cookies and
  Vercel's CDN can cache it.
- Speech services sit behind a small provider interface (`src/lib/tts/`), so
  Google or ElevenLabs can replace Sarvam without touching lessons.
- If recorded audio fails to load, Play falls back to the phone's own Kannada
  voice; with neither, it explains the problem.

### Decision
- Sarvam chosen over ElevenLabs (only its v3 model speaks Kannada, quality
  unknown) and AI Awaaz (no API found, so audio could not be generated by the
  app). Google remains the candidate for the planned listening comparison.

### Tested
- `npm test`: 66 tests, including the Sarvam request format, pace, error
  handling and the cache-busting addresses.
- Phone smoke test against a stand-in Sarvam: 29 steps, plus 26 steps with no
  voice service configured.

### Not tested
- The real Sarvam service: this workspace cannot reach it, and the key lives
  only in Vercel. How the `shubh` voice sounds in Kannada is untested.

## 2026-11-15 — Password reset

### Built
- "Forgot password?" link on the sign-in page, leading to a form that emails a
  reset link. It gives the same answer whether or not the account exists.
- `/reset-password`: set a new password (typed twice). Only reachable through
  the email link; otherwise it offers to send a new link.
- `/auth/confirm` now accepts both link styles Supabase sends: `?code=` (its
  default email, same browser only) and `?token_hash=` (the recommended
  template, any device). A failed reset link returns to "forgot password"
  with an explanation. It now redirects to the address the learner used
  rather than the server's own name, which could lose the session.
- Clear messages for Supabase's email limits ("not authorised", rate limit).

### Tested
- Phone smoke test, 7 new steps: request, unknown email, follow the default
  link, mismatched passwords refused, old password fails and new one works,
  the recommended link on a second device, a used link refused, the page
  refused without a link. 27 steps pass in total; `npm test` 56 tests pass.

### Not tested
- Real Supabase email delivery. Needs the settings in `docs/SETUP.md` step 2b.

## 2026-11-15 — Phase 2, milestone 2: Unit 1 lessons

### Built
- Unit 1 "Greetings and politeness" as `content/kn/level1-unit1-greetings.yaml`:
  two lessons, 17 sentences (15 shown, 2 drafts hidden) plus 2 alternatives.
- Content pipeline (`content-pipeline/`): strict file schema; romanises the
  Kannada script and fails if it disagrees with the English-letter form;
  checks word-by-word breakdowns add up to the sentence, variants exist, and
  every shown sentence names a source. `npm run content:build` writes
  `supabase/content.sql`, which is safe to re-run and keeps learner progress.
- `supabase/migrations/0002_lessons.sql`: `get_units`, `get_unit`,
  `get_lesson`, `complete_lesson`, `flag_sentence`. All run with the
  learner's own permissions; signed-out visitors cannot call them.
- Learn tab lists units with progress; Unit 1 opens, the rest say "Coming soon".
- Unit page and lesson page with sentence cards: English-letter Kannada,
  meaning, spoken / respectful / casual / Bengaluru labels, and "How it works"
  (word by word, why it is built that way, pronunciation, other ways to say it,
  sources). "I heard it differently" saves a note for re-checking.
- "I've learned these" marks the lesson done and queues its sentences for
  revision (scheduling arrives in milestone 4).
- Temporary audio: Play and Slow use the phone's own Kannada voice when one is
  installed; otherwise they are disabled and the reason is shown.
- Today's main button now opens Unit 1.
- Supabase address: anything after the base address (`/rest/v1/`, a trailing
  slash) is now ignored, fixing the "Invalid path specified" error seen on
  first setup.

### Content decisions
- Shown sentences are confirmed in at least one published phrase list
  (Preply, SWALPA, Sublearn, Multibhashi, KannadaMaadi). The second-model
  agreement check planned for `source_checked` has not been run yet.
- Two drafts stay hidden until a source confirms them: *āytu* (reply to
  "have you eaten?") and *hōgi banni* (reply to "I'll go and come").
- Written-style forms appear only as a note (e.g. chennāgiddēne), never as cards.

### Tested
- `npm test`: 55 tests. The content tests load the generated SQL into a real
  Postgres engine and read it back through the same functions the app calls:
  drafts hidden, variants and word breakdowns present, completing a lesson
  queues six cards once, reloading content keeps them, flags saved, signed-out
  calls refused, committed SQL matches the YAML.
- Phone-sized smoke test: 20 steps passing, including the full lesson flow
  against the stand-in server (which now runs the real database functions),
  Play/Slow speaking the Kannada script at two speeds with a stand-in voice,
  and a deliberately over-long Supabase address.
- typecheck, lint, build: clean.

### Not tested
- On your real Supabase project (needs the two new SQL files run first).
- A real phone's Kannada voice: only a stand-in voice was tested. Whether your
  phone has one, and how it sounds, is unknown.

### Next — milestone 3: sentence lab
- Patterns with swappable slots (e.g. nanage ___ bēku), negative and question forms.

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
- The smoke test is not wired into `npm test` (it needs a browser and a running server).
- `npm audit` reports 8 moderate findings, all inside the linting toolchain
  (development only, not shipped to users).

### Open questions
- Alar dictionary licence terms for reuse.
- Whether Azure pronunciation scoring covers Kannada (matters in phase 4).
