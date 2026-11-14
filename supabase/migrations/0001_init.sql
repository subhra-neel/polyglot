-- Polyglot — initial schema (Phase 2, milestone 1)
--
-- Layout
--   1. Content tables   — shared shape, every row carries a language code.
--   2. Learner tables   — one learner can only ever see their own rows.
--   3. System tables    — analytics events.
--   4. Row-level security.
--   5. New-user trigger.
--   6. Seed data        — languages, Kannada levels, Level 1 units.
--
-- Conventions
--   * Spoken language is the product. `text_roman` (Kannada in English
--     letters) is what learners read; `text_script` is kept only because
--     speech services need it, and is hidden in the app by default.
--   * Inflected word forms are stored in `vocab_forms`, never computed.
--   * Content is written by the service role (which bypasses RLS). Learners
--     only ever read content, and never see sentences still in `draft`.

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------

create type public.language_status as enum ('hidden', 'beta', 'live');

-- draft           — written, not yet checked. Never shown to learners.
-- source_checked  — pattern attested in a published reference, words checked
--                   in a dictionary, two models agree. Shown with a marker.
-- native_verified — confirmed by a native speaker.
create type public.validation_status as enum ('draft', 'source_checked', 'native_verified');

create type public.speech_register as enum ('neutral', 'colloquial', 'formal');
create type public.formality as enum ('neutral', 'respectful', 'casual');
create type public.variant_relation as enum ('respectful', 'casual', 'more_natural', 'alternative', 'negative', 'question');
create type public.exercise_type as enum ('reorder', 'fill_gap', 'listen_choose', 'listen_type', 'translate_to_target', 'build_from_pattern');
create type public.lesson_status as enum ('started', 'completed');
create type public.message_role as enum ('learner', 'tutor', 'system');
create type public.skill as enum ('listening', 'speaking', 'grammar', 'construction');

-- ---------------------------------------------------------------------------
-- 1. Content
-- ---------------------------------------------------------------------------

create table public.languages (
  code        text primary key check (code ~ '^[a-z]{2,3}$'),
  name        text not null,
  script_name text not null,
  status      public.language_status not null default 'hidden',
  position    smallint not null default 0
);

create table public.levels (
  id            bigint generated always as identity primary key,
  language_code text not null references public.languages (code) on delete cascade,
  number        smallint not null check (number between 1 and 5),
  title         text not null,
  can_do        text not null,
  unique (language_code, number)
);

create table public.units (
  id       bigint generated always as identity primary key,
  level_id bigint not null references public.levels (id) on delete cascade,
  position smallint not null,
  slug     text not null,
  title    text not null,
  summary  text,
  unique (level_id, position),
  unique (level_id, slug)
);

create table public.lessons (
  id       bigint generated always as identity primary key,
  unit_id  bigint not null references public.units (id) on delete cascade,
  position smallint not null,
  slug     text not null,
  title    text not null,
  unique (unit_id, position),
  unique (unit_id, slug)
);

create table public.sentences (
  id                 uuid primary key default gen_random_uuid(),
  language_code      text not null references public.languages (code) on delete cascade,
  lesson_id          bigint references public.lessons (id) on delete set null,
  position           smallint,
  text_roman         text not null,
  text_script        text,
  meaning_en         text not null,
  why_note           text,          -- how and why the sentence is built this way
  pronunciation_note text,
  register           public.speech_register not null default 'neutral',
  formality          public.formality not null default 'neutral',
  region             text,          -- e.g. 'Bengaluru'; null = used everywhere
  audio_path         text,          -- storage path, normal speed
  audio_slow_path    text,          -- storage path, slow speed
  validation_status  public.validation_status not null default 'draft',
  source_ref         text,          -- which reference attests the pattern
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index sentences_lesson_idx on public.sentences (lesson_id, position);
create index sentences_language_idx on public.sentences (language_code);

create table public.sentence_tokens (
  id            bigint generated always as identity primary key,
  sentence_id   uuid not null references public.sentences (id) on delete cascade,
  position      smallint not null,
  surface_roman text not null,      -- the word as it appears in the sentence
  lemma_roman   text,               -- dictionary form
  gloss_en      text not null,
  grammar_tags  text[] not null default '{}',
  unique (sentence_id, position)
);

create table public.sentence_variants (
  sentence_id         uuid not null references public.sentences (id) on delete cascade,
  variant_sentence_id uuid not null references public.sentences (id) on delete cascade,
  relation            public.variant_relation not null,
  primary key (sentence_id, variant_sentence_id),
  check (sentence_id <> variant_sentence_id)
);

create table public.vocab (
  id            bigint generated always as identity primary key,
  language_code text not null references public.languages (code) on delete cascade,
  lemma_roman   text not null,
  lemma_script  text,
  gloss_en      text not null,
  word_class    text not null,      -- noun, verb, pronoun, adjective, ...
  unique (language_code, lemma_roman, word_class)
);

create table public.vocab_forms (
  id          bigint generated always as identity primary key,
  vocab_id    bigint not null references public.vocab (id) on delete cascade,
  form_tag    text not null,        -- e.g. 'dative', 'locative', 'past.1sg'
  form_roman  text not null,
  form_script text,
  unique (vocab_id, form_tag)
);

create table public.patterns (
  id                  bigint generated always as identity primary key,
  language_code       text not null references public.languages (code) on delete cascade,
  slug                text not null,
  template_roman      text not null,   -- e.g. '{person} {thing} bēku'
  meaning_template_en text not null,   -- e.g. '{person} want(s) {thing}'
  explanation         text not null,
  level_number        smallint not null default 1 check (level_number between 1 and 5),
  unique (language_code, slug)
);

create table public.pattern_slots (
  id         bigint generated always as identity primary key,
  pattern_id bigint not null references public.patterns (id) on delete cascade,
  position   smallint not null,
  name       text not null,           -- matches the {name} in the template
  word_class text not null,           -- which vocab may fill the slot
  form_tag   text,                    -- which stored form the slot takes
  unique (pattern_id, name)
);

create table public.grammar_points (
  id            bigint generated always as identity primary key,
  language_code text not null references public.languages (code) on delete cascade,
  slug          text not null,
  title         text not null,
  explanation   text not null,
  unique (language_code, slug)
);

create table public.grammar_point_sentences (
  grammar_point_id bigint not null references public.grammar_points (id) on delete cascade,
  sentence_id      uuid not null references public.sentences (id) on delete cascade,
  primary key (grammar_point_id, sentence_id)
);

create table public.exercises (
  id          bigint generated always as identity primary key,
  lesson_id   bigint not null references public.lessons (id) on delete cascade,
  position    smallint not null,
  type        public.exercise_type not null,
  prompt      jsonb not null,
  answers     jsonb not null,          -- every accepted answer
  explanation text not null,           -- always say why
  unique (lesson_id, position)
);

create table public.scenarios (
  id            bigint generated always as identity primary key,
  language_code text not null references public.languages (code) on delete cascade,
  slug          text not null,
  title         text not null,
  persona       text not null,         -- e.g. 'A Bengaluru auto driver'
  setting       text not null,
  min_level     smallint not null default 1 check (min_level between 1 and 5),
  unique (language_code, slug)
);

create table public.dialogues (
  id           bigint generated always as identity primary key,
  scenario_id  bigint not null references public.scenarios (id) on delete cascade,
  title        text not null,
  level_number smallint not null default 1 check (level_number between 1 and 5)
);

create table public.dialogue_lines (
  id          bigint generated always as identity primary key,
  dialogue_id bigint not null references public.dialogues (id) on delete cascade,
  position    smallint not null,
  speaker     text not null,
  sentence_id uuid not null references public.sentences (id) on delete cascade,
  unique (dialogue_id, position)
);

-- ---------------------------------------------------------------------------
-- 2. Learner
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  display_name         text,
  daily_target_minutes smallint not null default 10 check (daily_target_minutes between 1 and 240),
  show_script          boolean not null default false,
  show_english         boolean not null default true,
  audio_speed          numeric(3, 2) not null default 1.00 check (audio_speed between 0.50 and 1.50),
  created_at           timestamptz not null default now()
);

create table public.enrollments (
  user_id       uuid not null references auth.users (id) on delete cascade,
  language_code text not null references public.languages (code) on delete cascade,
  level_number  smallint not null default 1 check (level_number between 1 and 5),
  started_at    timestamptz not null default now(),
  primary key (user_id, language_code)
);

create table public.lesson_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  lesson_id    bigint not null references public.lessons (id) on delete cascade,
  status       public.lesson_status not null default 'started',
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);

create table public.attempts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id) on delete cascade,
  answer      jsonb not null,
  is_correct  boolean not null,
  error_tags  text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index attempts_user_idx on public.attempts (user_id, created_at desc);

-- Spaced repetition. Field names follow the FSRS card model (ts-fsrs).
create table public.review_cards (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  sentence_id    uuid references public.sentences (id) on delete cascade,
  pattern_id     bigint references public.patterns (id) on delete cascade,
  due            timestamptz not null default now(),
  stability      double precision not null default 0,
  difficulty     double precision not null default 0,
  elapsed_days   integer not null default 0,
  scheduled_days integer not null default 0,
  reps           integer not null default 0,
  lapses         integer not null default 0,
  state          smallint not null default 0 check (state between 0 and 3),
  last_review    timestamptz,
  check (num_nonnulls(sentence_id, pattern_id) = 1),
  unique (user_id, sentence_id),
  unique (user_id, pattern_id)
);
create index review_cards_due_idx on public.review_cards (user_id, due);

create table public.review_logs (
  id          bigint generated always as identity primary key,
  card_id     bigint not null references public.review_cards (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 4),
  state       smallint not null check (state between 0 and 3),
  reviewed_at timestamptz not null default now()
);
create index review_logs_user_idx on public.review_logs (user_id, reviewed_at desc);

create table public.error_patterns (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  language_code text not null references public.languages (code) on delete cascade,
  tag           text not null,          -- e.g. 'dative_missing'
  occurrences   integer not null default 1,
  examples      jsonb not null default '[]',
  last_seen     timestamptz not null default now(),
  unique (user_id, language_code, tag)
);

create table public.skill_scores (
  user_id       uuid not null references auth.users (id) on delete cascade,
  language_code text not null references public.languages (code) on delete cascade,
  skill         public.skill not null,
  score         numeric(5, 2) not null default 0 check (score between 0 and 100),
  updated_at    timestamptz not null default now(),
  primary key (user_id, language_code, skill)
);

create table public.conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  language_code text not null references public.languages (code) on delete cascade,
  scenario_id   bigint references public.scenarios (id) on delete set null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);
create index conversations_user_idx on public.conversations (user_id, started_at desc);

create table public.messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.message_role not null,
  text_roman      text not null,
  text_script     text,
  gloss_en        text,
  correction      jsonb,                -- structured correction for learner turns
  audio_path      text,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- "I heard it differently" — the learner's way to send a sentence back for
-- re-checking. Stands in for native review during the private pilot.
create table public.sentence_flags (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  sentence_id uuid not null references public.sentences (id) on delete cascade,
  note        text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. System
-- ---------------------------------------------------------------------------

create table public.events (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete cascade,
  name       text not null,
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_user_idx on public.events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Row-level security
-- ---------------------------------------------------------------------------

-- Content: signed-in learners may read; nobody but the service role may write.
do $$
declare
  t text;
begin
  foreach t in array array[
    'languages', 'levels', 'units', 'lessons', 'sentence_tokens',
    'sentence_variants', 'vocab', 'vocab_forms', 'patterns', 'pattern_slots',
    'grammar_points', 'grammar_point_sentences', 'exercises', 'scenarios',
    'dialogues', 'dialogue_lines'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "signed-in users can read" on public.%I for select to authenticated using (true)', t
    );
  end loop;
end
$$;

-- Sentences: as above, but drafts stay invisible to learners.
alter table public.sentences enable row level security;
create policy "signed-in users can read checked sentences"
  on public.sentences for select to authenticated
  using (validation_status <> 'draft');

-- Learner data: each learner sees and changes only their own rows.
alter table public.profiles enable row level security;
create policy "own profile: read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'enrollments', 'lesson_progress', 'attempts', 'review_cards', 'review_logs',
    'error_patterns', 'skill_scores', 'conversations', 'messages', 'sentence_flags'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows only" on public.%I for all to authenticated '
      'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t
    );
  end loop;
end
$$;

-- Events: a learner may record and read their own; no edits or deletes.
alter table public.events enable row level security;
create policy "own events: insert" on public.events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own events: read" on public.events
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 5. Housekeeping triggers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger sentences_set_updated_at
  before update on public.sentences
  for each row execute function public.set_updated_at();

-- Every new account gets a profile and is enrolled in each live language.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;

  insert into public.enrollments (user_id, language_code)
  select new.id, l.code from public.languages l where l.status = 'live'
  on conflict do nothing;

  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 6. Seed: structure only. Sentences arrive through the content pipeline.
-- ---------------------------------------------------------------------------

insert into public.languages (code, name, script_name, status, position) values
  ('kn', 'Kannada', 'Kannada', 'live',   1),
  ('ta', 'Tamil',   'Tamil',   'hidden', 2),
  ('te', 'Telugu',  'Telugu',  'hidden', 3);

insert into public.levels (language_code, number, title, can_do) values
  ('kn', 1, 'Absolute beginner',   'Greet, introduce yourself, ask for things, ask where and how much'),
  ('kn', 2, 'Basic communication', 'Describe your day, family and plans; talk about yesterday'),
  ('kn', 3, 'Conversational',      'Shop, bargain, give and follow directions, explain a simple problem'),
  ('kn', 4, 'Intermediate',        'Handle work, phone calls, complaints and a clinic visit; give opinions'),
  ('kn', 5, 'Advanced',            'Converse spontaneously, joke, disagree politely, follow films and news');

insert into public.units (level_id, position, slug, title)
select l.id, u.position, u.slug, u.title
from public.levels l
cross join (values
  (1, 'greetings',        'Greetings and politeness'),
  (2, 'who-i-am',         'Who I am, who you are'),
  (3, 'this-and-that',    'This and that; yes and no'),
  (4, 'i-want',           'I want, I do not want'),
  (5, 'is-there',         'Is there, there is not; where'),
  (6, 'numbers-money',    'Numbers, money, how much'),
  (7, 'polite-requests',  'Come, go, give, stop: polite requests'),
  (8, 'repair',           'I did not understand: repairing a conversation')
) as u (position, slug, title)
where l.language_code = 'kn' and l.number = 1;
