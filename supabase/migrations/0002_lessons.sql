-- Polyglot — lesson reading and progress (Phase 2, milestone 2)
--
-- The app reads lessons through these functions rather than raw table
-- queries. Each one runs with the caller's own permissions (security
-- invoker), so row-level security still applies: drafts stay hidden and
-- progress rows belong only to the signed-in learner.

-- A short explanation of a word's parts, e.g. "hēge (how) + iddīri (you are)".
alter table public.sentence_tokens add column if not exists breakdown text;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- Units of one level, with how many lessons each has and how many are done.
create or replace function public.get_units(p_language text default 'kn', p_level smallint default 1)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(json_agg(json_build_object(
      'slug', u.slug,
      'title', u.title,
      'position', u.position,
      'lesson_count', (select count(*) from public.lessons le where le.unit_id = u.id),
      'completed_count', (
        select count(*) from public.lesson_progress lp
          join public.lessons le on le.id = lp.lesson_id
         where le.unit_id = u.id and lp.status = 'completed' and lp.user_id = (select auth.uid())
      )
    ) order by u.position), '[]'::json)
  from public.units u
  join public.levels l on l.id = u.level_id
  where l.language_code = p_language and l.number = p_level;
$$;

-- One unit and its lessons. Null when the unit does not exist.
create or replace function public.get_unit(p_unit_slug text, p_language text default 'kn')
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select json_build_object(
    'slug', u.slug,
    'title', u.title,
    'position', u.position,
    'level', l.number,
    'lessons', coalesce((
      select json_agg(json_build_object(
          'slug', le.slug,
          'title', le.title,
          'position', le.position,
          'sentence_count', (select count(*) from public.sentences s where s.lesson_id = le.id),
          'completed', exists (
            select 1 from public.lesson_progress lp
             where lp.lesson_id = le.id and lp.status = 'completed' and lp.user_id = (select auth.uid())
          )
        ) order by le.position)
      from public.lessons le where le.unit_id = u.id
    ), '[]'::json)
  )
  from public.units u
  join public.levels l on l.id = u.level_id
  where u.slug = p_unit_slug and l.language_code = p_language
  order by l.number
  limit 1;
$$;

-- One lesson with every sentence, its words and its variants.
create or replace function public.get_lesson(p_unit_slug text, p_lesson_slug text, p_language text default 'kn')
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select json_build_object(
    'unit', json_build_object('slug', u.slug, 'title', u.title, 'position', u.position),
    'lesson', json_build_object('slug', le.slug, 'title', le.title, 'position', le.position),
    'lesson_count', (select count(*) from public.lessons x where x.unit_id = u.id),
    'completed', exists (
      select 1 from public.lesson_progress lp
       where lp.lesson_id = le.id and lp.status = 'completed' and lp.user_id = (select auth.uid())
    ),
    'next_lesson', (
      select json_build_object('slug', n.slug, 'title', n.title)
        from public.lessons n
       where n.unit_id = u.id and n.position > le.position
       order by n.position limit 1
    ),
    'sentences', coalesce((
      select json_agg(json_build_object(
          'id', s.id,
          'roman', s.text_roman,
          'script', s.text_script,
          'meaning', s.meaning_en,
          'why', s.why_note,
          'pronunciation', s.pronunciation_note,
          'register', s.register,
          'formality', s.formality,
          'region', s.region,
          'status', s.validation_status,
          'sources', s.source_ref,
          'tokens', coalesce((
            select json_agg(json_build_object(
                'word', t.surface_roman, 'gloss', t.gloss_en, 'breakdown', t.breakdown
              ) order by t.position)
              from public.sentence_tokens t where t.sentence_id = s.id
          ), '[]'::json),
          'variants', coalesce((
            select json_agg(json_build_object(
                'relation', v.relation, 'roman', vs.text_roman, 'meaning', vs.meaning_en
              ) order by vs.text_roman)
              from public.sentence_variants v
              join public.sentences vs on vs.id = v.variant_sentence_id
             where v.sentence_id = s.id
          ), '[]'::json)
        ) order by s.position)
      from public.sentences s where s.lesson_id = le.id
    ), '[]'::json)
  )
  from public.units u
  join public.levels l on l.id = u.level_id
  join public.lessons le on le.unit_id = u.id
  where u.slug = p_unit_slug and le.slug = p_lesson_slug and l.language_code = p_language
  order by l.number
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------

-- Marks a lesson done and queues its sentences for revision.
-- Returns how many sentences were newly queued.
create or replace function public.complete_lesson(p_unit_slug text, p_lesson_slug text, p_language text default 'kn')
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_lesson bigint;
  v_added integer;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  select le.id into v_lesson
    from public.units u
    join public.levels l on l.id = u.level_id
    join public.lessons le on le.unit_id = u.id
   where u.slug = p_unit_slug and le.slug = p_lesson_slug and l.language_code = p_language
   order by l.number
   limit 1;

  if v_lesson is null then
    raise exception 'lesson not found';
  end if;

  insert into public.lesson_progress (user_id, lesson_id, status, completed_at)
  values (v_user, v_lesson, 'completed', now())
  on conflict (user_id, lesson_id) do update set status = 'completed', completed_at = now();

  -- Only sentences the learner can see (row-level security hides drafts).
  insert into public.review_cards (user_id, sentence_id)
  select v_user, s.id from public.sentences s where s.lesson_id = v_lesson
  on conflict do nothing;
  get diagnostics v_added = row_count;

  insert into public.events (user_id, name, props)
  values (v_user, 'lesson_completed', jsonb_build_object('lesson_id', v_lesson, 'queued', v_added));

  return v_added;
end
$$;

-- "I heard it differently": sends a sentence back for re-checking.
create or replace function public.flag_sentence(p_sentence_id uuid, p_note text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from public.sentences where id = p_sentence_id) then
    raise exception 'sentence not found';
  end if;

  insert into public.sentence_flags (user_id, sentence_id, note)
  values (v_user, p_sentence_id, nullif(left(trim(coalesce(p_note, '')), 500), ''));
end
$$;

-- Signed-out visitors may not call any of these.
revoke execute on function public.get_units(text, smallint) from public, anon;
revoke execute on function public.get_unit(text, text) from public, anon;
revoke execute on function public.get_lesson(text, text, text) from public, anon;
revoke execute on function public.complete_lesson(text, text, text) from public, anon;
revoke execute on function public.flag_sentence(uuid, text) from public, anon;
grant execute on function public.get_units(text, smallint) to authenticated;
grant execute on function public.get_unit(text, text) to authenticated;
grant execute on function public.get_lesson(text, text, text) to authenticated;
grant execute on function public.complete_lesson(text, text, text) to authenticated;
grant execute on function public.flag_sentence(uuid, text) to authenticated;

-- Tell Supabase's API to pick up the new functions straight away.
notify pgrst, 'reload schema';
