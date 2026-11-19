-- Unit check results, and a summary of the learner's weak spots.
--
-- A finished unit check is saved; every sentence the learner missed is put
-- back into revision (due now), so mistakes turn into practice. As with the
-- other functions, everything runs with the learner's own permissions and
-- row-level security keeps results private.

create table if not exists public.unit_checks (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unit_id    bigint not null references public.units (id) on delete cascade,
  score      smallint not null check (score >= 0),
  total      smallint not null check (total between 1 and 50),
  missed     uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (score <= total)
);
create index if not exists unit_checks_user_idx on public.unit_checks (user_id, created_at desc);

alter table public.unit_checks enable row level security;

drop policy if exists "unit checks: read own" on public.unit_checks;
create policy "unit checks: read own" on public.unit_checks
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "unit checks: add own" on public.unit_checks;
create policy "unit checks: add own" on public.unit_checks
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Saves a finished check and sends missed sentences back to revision.
create or replace function public.record_unit_check(
  p_unit_slug text,
  p_score integer,
  p_total integer,
  p_missed uuid[] default '{}',
  p_language text default 'kn'
)
returns json
language plpgsql security invoker set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_unit bigint;
  v_missed uuid[];
begin
  if v_user is null then raise exception 'not signed in'; end if;
  select u.id into v_unit
    from public.units u join public.levels l on l.id = u.level_id
   where l.language_code = p_language and u.slug = p_unit_slug;
  if v_unit is null then raise exception 'unknown unit %', p_unit_slug; end if;

  -- Only sentences of this unit that the learner can see.
  select coalesce(array_agg(s.id), '{}') into v_missed
    from public.sentences s join public.lessons le on le.id = s.lesson_id
   where le.unit_id = v_unit and s.id = any (coalesce(p_missed, '{}'));

  insert into public.unit_checks (user_id, unit_id, score, total, missed)
  values (v_user, v_unit, p_score, p_total, v_missed);

  insert into public.review_cards (user_id, sentence_id, due)
  select v_user, m, now() from unnest(v_missed) m
  on conflict (user_id, sentence_id) do update set due = least(public.review_cards.due, now());

  return json_build_object('saved', true, 'back_to_revision', coalesce(array_length(v_missed, 1), 0));
end
$$;

-- Weak spots for the Me page: each checked unit's latest and best score,
-- weakest first, and the mistakes the tutor sees most.
create or replace function public.get_weak_spots(p_language text default 'kn')
returns json
language sql stable security invoker set search_path = ''
as $$
  select json_build_object(
    'units', coalesce((
      select json_agg(x order by x.last_pct, x.slug)
      from (
        select u.slug, u.title, l.number as level,
               last.score as last_score, last.total as last_total,
               round(100.0 * last.score / last.total) as last_pct,
               (select round(100.0 * max(c.score::numeric / c.total))
                  from public.unit_checks c where c.unit_id = u.id and c.user_id = (select auth.uid())) as best_pct,
               (select count(*) from public.unit_checks c where c.unit_id = u.id and c.user_id = (select auth.uid())) as attempts,
               last.created_at as last_at
          from public.units u
          join public.levels l on l.id = u.level_id and l.language_code = p_language
          join lateral (
            select c.score, c.total, c.created_at from public.unit_checks c
             where c.unit_id = u.id and c.user_id = (select auth.uid())
             order by c.created_at desc limit 1
          ) last on true
      ) x
    ), '[]'::json),
    'mistakes', coalesce((
      select json_agg(json_build_object('tag', e.tag, 'occurrences', e.occurrences, 'example', e.examples->0)
                      order by e.occurrences desc, e.last_seen desc)
        from (select * from public.error_patterns
               where user_id = (select auth.uid()) and language_code = p_language
               order by occurrences desc, last_seen desc limit 5) e
    ), '[]'::json)
  );
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.record_unit_check(text, integer, integer, uuid[], text)',
    'public.get_weak_spots(text)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

grant select, insert on public.unit_checks to authenticated;

notify pgrst, 'reload schema';
