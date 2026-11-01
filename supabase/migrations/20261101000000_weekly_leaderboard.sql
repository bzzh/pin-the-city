-- Weekly leaderboard: players (nickname + secret key) and one verified score per player per day.

create table public.players (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  -- Normalised nickname (lowercase, no accents or separators) so "Hélène" and "helene" clash.
  nickname_key text not null unique,
  -- SHA-256 of the secret key kept in the player's browser; the key itself is never stored.
  token_hash text not null,
  created_at timestamptz not null default now()
);

create table public.daily_scores (
  player_id uuid not null references public.players (id) on delete cascade,
  day date not null,
  points integer not null check (points between 0 and 10000),
  created_at timestamptz not null default now(),
  primary key (player_id, day)
);

create index daily_scores_day_idx on public.daily_scores (day);

-- Row level security with no policies: the public (publishable) key can neither read nor write
-- these tables. Scores only arrive through the submit-score function, which uses the service
-- role after re-checking them, and are only read through weekly_leaderboard() below.
alter table public.players enable row level security;
alter table public.daily_scores enable row level security;

-- Top players for the week starting on `week_start` (a Monday): total of their daily scores
-- and how many of the 7 days they played. Ties share a rank.
create or replace function public.weekly_leaderboard(week_start date, max_rows integer default 10)
returns table (rank bigint, nickname text, days_played bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    rank() over (order by sum(s.points) desc) as rank,
    p.nickname,
    count(*) as days_played,
    sum(s.points) as total
  from daily_scores s
  join players p on p.id = s.player_id
  where s.day >= week_start and s.day < week_start + 7
  group by p.id, p.nickname
  order by total desc, p.nickname
  limit least(greatest(max_rows, 1), 50);
$$;

revoke all on function public.weekly_leaderboard(date, integer) from public;
grant execute on function public.weekly_leaderboard(date, integer) to anon, authenticated;
