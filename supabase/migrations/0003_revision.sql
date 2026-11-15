-- Polyglot — revision, progress and settings (Phase 2, milestone 4)
--
-- Scheduling is computed in the app with FSRS (ts-fsrs); these functions
-- only read and store the learner's own cards. All run with the caller's
-- permissions, so row-level security keeps each learner to their own rows.

alter table public.review_cards add column if not exists learning_steps integer not null default 0;
alter table public.profiles add column if not exists daily_review_goal smallint not null default 20
  check (daily_review_goal between 1 and 500);
alter table public.profiles add column if not exists time_zone text not null default 'Asia/Kolkata';

-- One card's scheduling state plus what the learner sees on it.
create or replace function public.card_json(c public.review_cards)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select json_build_object(
    'id', c.id,
    'due', c.due,
    'stability', c.stability,
    'difficulty', c.difficulty,
    'elapsed_days', c.elapsed_days,
    'scheduled_days', c.scheduled_days,
    'learning_steps', c.learning_steps,
    'reps', c.reps,
    'lapses', c.lapses,
    'state', c.state,
    'last_review', c.last_review,
    'sentence', (
      select json_build_object(
        'id', s.id, 'roman', s.text_roman, 'script', s.text_script, 'meaning', s.meaning_en,
        'why', s.why_note, 'formality', s.formality, 'register', s.register
      )
      from public.sentences s where s.id = c.sentence_id
    )
  );
$$;

-- Cards due now, soonest first. Cards whose sentence the learner can no
-- longer see (moved back to draft) are skipped.
create or replace function public.get_review_queue(p_limit integer default 20)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(json_agg(public.card_json(q) order by q.due), '[]'::json)
  from (
    select c.* from public.review_cards c
    join public.sentences s on s.id = c.sentence_id
    where c.user_id = (select auth.uid()) and c.due <= now()
    order by c.due
    limit greatest(1, least(p_limit, 100))
  ) q;
$$;

create or replace function public.get_review_card(p_card_id bigint)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select public.card_json(c) from public.review_cards c
  where c.id = p_card_id and c.user_id = (select auth.uid());
$$;

-- Stores the outcome of one review, already scheduled by the app.
create or replace function public.record_review(
  p_card_id bigint,
  p_rating smallint,
  p_due timestamptz,
  p_stability double precision,
  p_difficulty double precision,
  p_elapsed_days integer,
  p_scheduled_days integer,
  p_learning_steps integer,
  p_reps integer,
  p_lapses integer,
  p_state smallint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'not signed in'; end if;
  if p_rating not between 1 and 4 then raise exception 'rating must be 1 to 4'; end if;

  update public.review_cards set
    due = p_due, stability = p_stability, difficulty = p_difficulty,
    elapsed_days = p_elapsed_days, scheduled_days = p_scheduled_days,
    learning_steps = p_learning_steps, reps = p_reps, lapses = p_lapses,
    state = p_state, last_review = now()
  where id = p_card_id and user_id = v_user;

  if not found then raise exception 'card not found'; end if;

  insert into public.review_logs (card_id, user_id, rating, state)
  values (p_card_id, v_user, p_rating, p_state);
end
$$;

-- Everything the Today and Me screens show.
create or replace function public.get_progress(p_language text default 'kn')
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select p.*, (date_trunc('day', now() at time zone p.time_zone) at time zone p.time_zone) as day_start
    from public.profiles p where p.id = (select auth.uid())
  ),
  cards as (
    select c.* from public.review_cards c
    join public.sentences s on s.id = c.sentence_id and s.language_code = p_language
    where c.user_id = (select auth.uid())
  ),
  logs as (
    select l.* from public.review_logs l join cards c on c.id = l.card_id
  )
  select json_build_object(
    'daily_review_goal', (select daily_review_goal from me),
    'show_english', (select show_english from me),
    'show_script', (select show_script from me),
    'time_zone', (select time_zone from me),
    'due_now', (select count(*) from cards where due <= now()),
    'due_today', (select count(*) from cards where due < (select day_start from me) + interval '1 day'),
    'reviewed_today', (select count(*) from logs where reviewed_at >= (select day_start from me)),
    'sentences_started', (select count(*) from cards),
    'sentences_retained', (select count(*) from cards where state = 2 and stability >= 7),
    'reviews_30d', (select count(*) from logs where reviewed_at >= now() - interval '30 days'),
    'recall_rate_30d', (
      select round(100.0 * count(*) filter (where rating >= 3) / nullif(count(*), 0))
      from logs where reviewed_at >= now() - interval '30 days'
    ),
    'lessons_completed', (
      select count(*) from public.lesson_progress lp
      where lp.user_id = (select auth.uid()) and lp.status = 'completed'
    ),
    'next_lesson', (
      select json_build_object('unit_slug', u.slug, 'unit_title', u.title, 'unit_position', u.position,
                               'lesson_slug', le.slug, 'lesson_title', le.title)
      from public.lessons le
      join public.units u on u.id = le.unit_id
      join public.levels lv on lv.id = u.level_id
      where lv.language_code = p_language
        and not exists (
          select 1 from public.lesson_progress lp
          where lp.lesson_id = le.id and lp.user_id = (select auth.uid()) and lp.status = 'completed'
        )
        and exists (select 1 from public.sentences s where s.lesson_id = le.id)
      order by lv.number, u.position, le.position
      limit 1
    ),
    'flags_open', (
      select count(*) from public.sentence_flags f where f.user_id = (select auth.uid()) and not f.resolved
    )
  );
$$;

create or replace function public.update_settings(
  p_show_english boolean,
  p_show_script boolean,
  p_daily_review_goal smallint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  update public.profiles set
    show_english = p_show_english,
    show_script = p_show_script,
    daily_review_goal = greatest(1, least(p_daily_review_goal, 500))
  where id = (select auth.uid());
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.card_json(public.review_cards)',
    'public.get_review_queue(integer)',
    'public.get_review_card(bigint)',
    'public.record_review(bigint, smallint, timestamptz, double precision, double precision, integer, integer, integer, integer, integer, smallint)',
    'public.get_progress(text)',
    'public.update_settings(boolean, boolean, smallint)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

notify pgrst, 'reload schema';
