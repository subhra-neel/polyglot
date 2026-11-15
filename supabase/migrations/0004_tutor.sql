-- Polyglot — AI tutor conversations (Phase 3)
--
-- Scenarios, conversation history, and the learner's recurring mistakes.
-- All functions run with the caller's permissions; row-level security keeps
-- conversations and mistakes private to each learner.

alter table public.scenarios add column if not exists goals text not null default '';
alter table public.scenarios add column if not exists opening_hint text not null default '';
alter table public.scenarios add column if not exists position smallint not null default 0;

insert into public.scenarios (language_code, slug, title, persona, setting, goals, opening_hint, min_level, position) values
  ('kn', 'new-neighbour', 'Meeting a new neighbour',
   'Lakshmi, a friendly woman in her fifties who lives in the flat opposite yours in a Bengaluru apartment building. Warm, curious, speaks simple everyday Bengaluru Kannada.',
   'You have just moved in. She greets you in the lift.',
   'Greet each other, ask how each other are, ask whether the learner has eaten, say goodbye politely.',
   'Try: namaskāra · hēgiddīrā? · chennāgiddīni, nīvu?', 1, 1),
  ('kn', 'tea-stall', 'At a tea stall',
   'Manju, who runs a small tea and coffee stall near a bus stop in Bengaluru. Busy, quick, friendly, speaks casual Bengaluru Kannada.',
   'You walk up to the stall in the morning.',
   'Order coffee or tea, ask for water, ask how much it is, say thank you.',
   'Try: ondu kāfi koDi · nīru ideyā? · eshTu?', 1, 2),
  ('kn', 'auto-ride', 'Taking an auto',
   'Ramesh, a Bengaluru auto-rickshaw driver. Direct, a little impatient, but helpful. Speaks casual Bengaluru Kannada.',
   'You wave down an auto on the main road.',
   'Say where you want to go, ask how much, agree or refuse politely, say thank you at the end.',
   'Try: … ge hōgbēku · eshTu? · sari · bēDa', 1, 3)
on conflict (language_code, slug) do update set
  title = excluded.title, persona = excluded.persona, setting = excluded.setting,
  goals = excluded.goals, opening_hint = excluded.opening_hint, position = excluded.position;

create or replace function public.get_scenarios(p_language text default 'kn')
returns json
language sql stable security invoker set search_path = ''
as $$
  select coalesce(json_agg(json_build_object(
    'slug', s.slug, 'title', s.title, 'setting', s.setting, 'goals', s.goals,
    'opening_hint', s.opening_hint, 'min_level', s.min_level,
    'conversations', (select count(*) from public.conversations c
                      where c.scenario_id = s.id and c.user_id = (select auth.uid()))
  ) order by s.position), '[]'::json)
  from public.scenarios s where s.language_code = p_language;
$$;

create or replace function public.start_conversation(p_scenario_slug text, p_language text default 'kn')
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_scenario bigint;
  v_id uuid;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  select id into v_scenario from public.scenarios where slug = p_scenario_slug and language_code = p_language;
  if v_scenario is null then raise exception 'scenario not found'; end if;
  insert into public.conversations (user_id, language_code, scenario_id)
  values (v_user, p_language, v_scenario) returning id into v_id;
  insert into public.events (user_id, name, props)
  values (v_user, 'conversation_started', jsonb_build_object('scenario', p_scenario_slug));
  return v_id;
end
$$;

create or replace function public.get_conversation(p_id uuid)
returns json
language sql stable security invoker set search_path = ''
as $$
  select json_build_object(
    'id', c.id,
    'started_at', c.started_at,
    'ended_at', c.ended_at,
    'language', c.language_code,
    'scenario', (select json_build_object('slug', s.slug, 'title', s.title, 'persona', s.persona,
                                          'setting', s.setting, 'goals', s.goals, 'opening_hint', s.opening_hint)
                 from public.scenarios s where s.id = c.scenario_id),
    'messages', coalesce((
      select json_agg(json_build_object(
        'id', m.id, 'role', m.role, 'roman', m.text_roman, 'script', m.text_script,
        'english', m.gloss_en, 'correction', m.correction, 'created_at', m.created_at
      ) order by m.created_at, m.id)
      from public.messages m where m.conversation_id = c.id
    ), '[]'::json)
  )
  from public.conversations c
  where c.id = p_id and c.user_id = (select auth.uid());
$$;

create or replace function public.list_conversations(p_limit integer default 10)
returns json
language sql stable security invoker set search_path = ''
as $$
  select coalesce(json_agg(row_to_json(x) order by x.started_at desc), '[]'::json) from (
    select c.id, c.started_at, c.ended_at, s.title,
           (select count(*) from public.messages m where m.conversation_id = c.id and m.role = 'learner') as turns,
           (select count(*) from public.messages m where m.conversation_id = c.id and m.role = 'learner'
              and m.correction->>'category' in ('error', 'unnatural', 'register')) as corrections
    from public.conversations c left join public.scenarios s on s.id = c.scenario_id
    where c.user_id = (select auth.uid())
    order by c.started_at desc
    limit greatest(1, least(p_limit, 50))
  ) x;
$$;

-- Adds one message to the learner's own conversation. Returns its id.
create or replace function public.add_message(
  p_conversation_id uuid,
  p_role public.message_role,
  p_text_roman text,
  p_text_script text default null,
  p_gloss_en text default null,
  p_correction jsonb default null
)
returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id bigint;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.conversations where id = p_conversation_id and user_id = v_user) then
    raise exception 'conversation not found';
  end if;
  if length(p_text_roman) > 2000 then raise exception 'message too long'; end if;
  insert into public.messages (conversation_id, user_id, role, text_roman, text_script, gloss_en, correction)
  values (p_conversation_id, v_user, p_role, p_text_roman, p_text_script, p_gloss_en, p_correction)
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.end_conversation(p_id uuid)
returns void
language sql security invoker set search_path = ''
as $$
  update public.conversations set ended_at = coalesce(ended_at, now())
  where id = p_id and user_id = (select auth.uid());
$$;

-- Counts recurring mistakes so the tutor can bring them up later.
create or replace function public.record_mistakes(p_language text, p_tags text[], p_example jsonb)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_tag text;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  foreach v_tag in array coalesce(p_tags, '{}') loop
    if v_tag !~ '^[a-z_]{1,40}$' then continue; end if;
    insert into public.error_patterns (user_id, language_code, tag, occurrences, examples, last_seen)
    values (v_user, p_language, v_tag, 1, jsonb_build_array(p_example), now())
    on conflict (user_id, language_code, tag) do update set
      occurrences = public.error_patterns.occurrences + 1,
      -- keep the five most recent examples
      examples = (select coalesce(jsonb_agg(e), '[]'::jsonb) from (
                    select e from jsonb_array_elements(jsonb_build_array(p_example) || public.error_patterns.examples) e
                    limit 5) t),
      last_seen = now();
  end loop;
end
$$;

-- What the tutor should know about this learner.
create or replace function public.get_tutor_context(p_language text default 'kn')
returns json
language sql stable security invoker set search_path = ''
as $$
  select json_build_object(
    'level', coalesce((select level_number from public.enrollments
                       where user_id = (select auth.uid()) and language_code = p_language), 1),
    'mistakes', coalesce((
      select json_agg(json_build_object('tag', e.tag, 'occurrences', e.occurrences, 'example', e.examples->0)
                      order by e.occurrences desc, e.last_seen desc)
      from (select * from public.error_patterns
            where user_id = (select auth.uid()) and language_code = p_language
            order by occurrences desc, last_seen desc limit 5) e
    ), '[]'::json),
    'known_sentences', coalesce((
      select json_agg(s.text_roman || ' = ' || s.meaning_en)
      from (select s.* from public.review_cards c join public.sentences s on s.id = c.sentence_id
            where c.user_id = (select auth.uid()) and s.language_code = p_language
            order by c.last_review desc nulls last limit 40) s
    ), '[]'::json)
  );
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.get_scenarios(text)',
    'public.start_conversation(text, text)',
    'public.get_conversation(uuid)',
    'public.list_conversations(integer)',
    'public.add_message(uuid, public.message_role, text, text, text, jsonb)',
    'public.end_conversation(uuid)',
    'public.record_mistakes(text, text[], jsonb)',
    'public.get_tutor_context(text)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

notify pgrst, 'reload schema';
