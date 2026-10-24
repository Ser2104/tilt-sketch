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
  if p_board <> 'levels' and p_board not in ('daily-' || today, 'daily-' || yesterday) then
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
