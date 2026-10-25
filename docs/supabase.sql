-- Tilt Sketch shared rankings. Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.scores (
  board      text        not null check (char_length(board) between 1 and 40),
  device     uuid        not null,
  player     text        not null check (char_length(player) between 1 and 24),
  score      int         not null default 0 check (score between 0 and 100),
  level      int         not null default 0 check (level between 0 and 1000),
  stars      int         not null default 0 check (stars between 0 and 3000),
  updated_at timestamptz not null default now(),
  primary key (board, device)
);

alter table public.scores enable row level security;
revoke all on public.scores from anon, authenticated;

create or replace view public.leaderboard as
  select board, player, score, level, stars, updated_at from public.scores;
grant select on public.leaderboard to anon, authenticated;

create or replace function public.submit_score(
  p_board text, p_device uuid, p_player text, p_score int, p_level int default 0, p_stars int default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  yesterday text := to_char((now() at time zone 'utc') - interval '1 day', 'YYYY-MM-DD');
begin
  if p_board not in ('levels', 'guided') and p_board not in ('daily-' || today, 'daily-' || yesterday) then
    raise exception 'unknown or closed board';
  end if;
  if char_length(trim(p_player)) = 0 then
    raise exception 'empty name';
  end if;
  insert into scores (board, device, player, score, level, stars)
  values (p_board, p_device, left(trim(p_player), 24), least(greatest(p_score, 0), 100), greatest(p_level, 0), greatest(p_stars, 0))
  on conflict (board, device) do update set
    player     = excluded.player,
    score      = case when scores.board like 'daily-%' then scores.score else greatest(scores.score, excluded.score) end,
    level      = greatest(scores.level, excluded.level),
    stars      = greatest(scores.stars, excluded.stars),
    updated_at = now();
end;
$$;

revoke all on function public.submit_score(text, uuid, text, int, int, int) from public;
grant execute on function public.submit_score(text, uuid, text, int, int, int) to anon, authenticated;

-- Hardening: the view respects table permissions; players can read every column except device.
alter view public.leaderboard set (security_invoker = true);
grant select (board, player, score, level, stars, updated_at) on public.scores to anon;
drop policy if exists "Leaderboard is public" on public.scores;
create policy "Leaderboard is public" on public.scores for select to anon using (true);
revoke execute on function public.submit_score(text, uuid, text, int, int, int) from authenticated;

-- ---------- Drawing donations and clinician sharing (see docs/PRIVACY.md) ----------
create extension if not exists pgcrypto with schema extensions;

-- Donated drawings: opt-in, anonymous, deletable. Used to retrain the AI on real gyroscope drawings.
create table if not exists public.drawings (
  id         bigint generated always as identity primary key,
  device     uuid        not null,
  word       text        not null,
  strokes    jsonb       not null check (jsonb_typeof(strokes) = 'array' and pg_column_size(strokes) < 60000),
  ctrl       text        check (ctrl in ('look', 'tilt')),
  ai_guess   text        check (char_length(ai_guess) <= 40),
  ai_score   int         check (ai_score between 0 and 100),
  created_at timestamptz not null default now()
);
create index if not exists drawings_device on public.drawings (device);
alter table public.drawings enable row level security;
revoke all on public.drawings from anon, authenticated;

create or replace function public.donate_drawing(p_device uuid, p_word text, p_strokes jsonb, p_ctrl text, p_guess text, p_score int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_word not in ('cat','dog','house','tree','bicycle','airplane','guitar','umbrella','cup','flower','key','clock','shoe','mountain','sailboat','ice cream','scissors','eyeglasses','fish','hat','snail','light bulb','sea turtle','ladder','cloud','hammer','hamburger','crown','pizza','sun','moon','star','butterfly','spider','castle','train','car','pineapple','strawberry','mushroom','cactus','penguin','giraffe','elephant','snake','fork','lighthouse','tent','rainbow','snowman','television','pencil','candle','smiley face','hot air balloon','watermelon','octopus','whale','owl','shark','helicopter','hourglass','skull','lightning','snowflake','sword','helmet','dragon','flying saucer','mermaid','angel','diamond','bee','rabbit','frog','camera','headphones','Eiffel Tower') then raise exception 'unknown object'; end if;
  if jsonb_typeof(p_strokes) <> 'array' or jsonb_array_length(p_strokes) not between 1 and 80 then raise exception 'bad drawing'; end if;
  if (select count(*) from drawings where device = p_device and created_at > now() - interval '1 day') >= 300 then raise exception 'daily limit'; end if;
  insert into drawings (device, word, strokes, ctrl, ai_guess, ai_score)
  values (p_device, p_word, p_strokes, case when p_ctrl in ('look', 'tilt') then p_ctrl end, left(p_guess, 40), least(greatest(p_score, 0), 100));
end; $$;

create or replace function public.delete_my_drawings(p_device uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from drawings where device = p_device;
  get diagnostics n = row_count;
  return n;
end; $$;

create or replace function public.donation_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('drawings', count(*), 'objects', count(distinct word), 'players', count(distinct device)) from drawings;
$$;

-- Clinician sharing: a clinician creates a clinic (public join code + private key); patients choose to share practice summaries.
create table if not exists public.clinics (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique,
  key_hash    bytea       not null,
  name        text        not null check (char_length(name) between 1 and 60),
  created_at  timestamptz not null default now()
);
create table if not exists public.clinic_patients (
  id         bigint generated always as identity primary key,
  clinic_id  uuid        not null references public.clinics on delete cascade,
  device     uuid        not null,
  alias      text        not null check (char_length(alias) between 1 and 24),
  joined_at  timestamptz not null default now(),
  unique (clinic_id, device)
);
create table if not exists public.clinic_sessions (
  id          bigint generated always as identity primary key,
  patient_id  bigint      not null references public.clinic_patients on delete cascade,
  session     jsonb       not null check (jsonb_typeof(session) = 'object' and pg_column_size(session) < 20000),
  created_at  timestamptz not null default now()
);
create index if not exists clinic_sessions_patient on public.clinic_sessions (patient_id);
alter table public.clinics enable row level security;
alter table public.clinic_patients enable row level security;
alter table public.clinic_sessions enable row level security;
revoke all on public.clinics, public.clinic_patients, public.clinic_sessions from anon, authenticated;

create or replace function public.create_clinic(p_name text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare c text; k text; abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'empty name'; end if;
  if (select count(*) from clinics where created_at > now() - interval '1 hour') >= 100 then raise exception 'try again later'; end if;
  loop
    c := (select string_agg(substr(abc, 1 + (get_byte(b, i) % 31), 1), '') from (select gen_random_bytes(6) b) r, generate_series(0, 5) i);
    exit when not exists (select 1 from clinics where code = c);
  end loop;
  k := encode(gen_random_bytes(18), 'hex');
  insert into clinics (code, key_hash, name) values (c, digest(k, 'sha256'), left(trim(p_name), 60));
  return json_build_object('code', c, 'key', k, 'name', left(trim(p_name), 60));
end; $$;

create or replace function public.join_clinic(p_code text, p_device uuid, p_alias text)
returns text language plpgsql security definer set search_path = public as $$
declare cl clinics;
begin
  select * into cl from clinics where code = upper(trim(p_code));
  if not found then raise exception 'unknown clinic code'; end if;
  if char_length(trim(coalesce(p_alias, ''))) = 0 then raise exception 'empty name'; end if;
  insert into clinic_patients (clinic_id, device, alias) values (cl.id, p_device, left(trim(p_alias), 24))
  on conflict (clinic_id, device) do update set alias = excluded.alias;
  return cl.name;
end; $$;

create or replace function public.share_session(p_code text, p_device uuid, p_session jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare pid bigint;
begin
  select p.id into pid from clinic_patients p join clinics c on c.id = p.clinic_id where c.code = upper(trim(p_code)) and p.device = p_device;
  if pid is null then raise exception 'not connected'; end if;
  if (select count(*) from clinic_sessions where patient_id = pid and created_at > now() - interval '1 day') >= 60 then raise exception 'daily limit'; end if;
  insert into clinic_sessions (patient_id, session) values (pid, p_session);
end; $$;

create or replace function public.leave_clinic(p_code text, p_device uuid)
returns void language sql security definer set search_path = public as $$
  delete from clinic_patients p using clinics c where c.id = p.clinic_id and c.code = upper(trim(p_code)) and p.device = p_device;
$$;

create or replace function public.clinic_report(p_code text, p_key text)
returns json language plpgsql stable security definer set search_path = public, extensions as $$
declare cl clinics;
begin
  select * into cl from clinics where code = upper(trim(p_code)) and key_hash = digest(coalesce(p_key, ''), 'sha256');
  if not found then raise exception 'wrong clinic code or key'; end if;
  return json_build_object('name', cl.name, 'code', cl.code, 'patients', coalesce((
    select json_agg(json_build_object('id', p.id, 'alias', p.alias, 'joined_at', p.joined_at, 'sessions', coalesce((
      select json_agg(s.session order by s.session->>'date') from clinic_sessions s where s.patient_id = p.id), '[]'::json)) order by p.joined_at)
    from clinic_patients p where p.clinic_id = cl.id), '[]'::json));
end; $$;

create or replace function public.clinic_remove_patient(p_code text, p_key text, p_patient bigint)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare cl clinics;
begin
  select * into cl from clinics where code = upper(trim(p_code)) and key_hash = digest(coalesce(p_key, ''), 'sha256');
  if not found then raise exception 'wrong clinic code or key'; end if;
  delete from clinic_patients where id = p_patient and clinic_id = cl.id;
end; $$;

do $$
declare f text;
begin
  foreach f in array array['donate_drawing(uuid, text, jsonb, text, text, int)', 'delete_my_drawings(uuid)', 'donation_stats()',
    'create_clinic(text)', 'join_clinic(text, uuid, text)', 'share_session(text, uuid, jsonb)', 'leave_clinic(text, uuid)',
    'clinic_report(text, text)', 'clinic_remove_patient(text, text, bigint)'] loop
    execute format('revoke all on function public.%s from public, authenticated', f);
    execute format('grant execute on function public.%s to anon', f);
  end loop;
end $$;

-- ---------- In-app feedback (anonymous survey answers) ----------
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  device     uuid        not null,
  context    text        not null check (context in ('practice', 'game', 'challenge', 'guided', 'general')),
  ease       int         check (ease between 1 and 5),
  again      int         check (again between 1 and 5),
  helped     int         check (helped between 1 and 5),
  comment    text        check (char_length(comment) <= 500),
  lang       text        check (lang in ('en', 'es')),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create or replace function public.submit_feedback(p_device uuid, p_context text, p_ease int, p_again int, p_helped int, p_comment text, p_lang text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_context not in ('practice', 'game', 'challenge', 'guided', 'general') then raise exception 'unknown context'; end if;
  if p_ease is null and p_again is null and p_helped is null and char_length(trim(coalesce(p_comment, ''))) = 0 then raise exception 'empty feedback'; end if;
  if (select count(*) from feedback where device = p_device and created_at > now() - interval '1 day') >= 20 then raise exception 'daily limit'; end if;
  insert into feedback (device, context, ease, again, helped, comment, lang)
  values (p_device, p_context,
    case when p_ease between 1 and 5 then p_ease end, case when p_again between 1 and 5 then p_again end,
    case when p_helped between 1 and 5 then p_helped end, nullif(left(trim(coalesce(p_comment, '')), 500), ''),
    case when p_lang in ('en', 'es') then p_lang end);
end; $$;

create or replace function public.feedback_summary()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('answers', count(*), 'people', count(distinct device),
    'ease', round(avg(ease), 2), 'again', round(avg(again), 2), 'helped', round(avg(helped), 2),
    'would_use_again_pct', round(100.0 * count(*) filter (where again >= 4) / nullif(count(again), 0)))
  from feedback;
$$;

revoke all on function public.submit_feedback(uuid, text, int, int, int, text, text) from public, authenticated;
grant execute on function public.submit_feedback(uuid, text, int, int, int, text, text) to anon;
revoke all on function public.feedback_summary() from public, authenticated;
grant execute on function public.feedback_summary() to anon;
