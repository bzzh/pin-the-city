-- Daily leaderboard: top players for a single day's challenge. Ties share a rank.
create or replace function public.daily_leaderboard(for_day date, max_rows integer default 10)
returns table (rank bigint, nickname text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    rank() over (order by s.points desc) as rank,
    p.nickname,
    s.points::bigint as total
  from daily_scores s
  join players p on p.id = s.player_id
  where s.day = for_day
  order by s.points desc, p.nickname
  limit least(greatest(max_rows, 1), 50);
$$;

revoke all on function public.daily_leaderboard(date, integer) from public;
grant execute on function public.daily_leaderboard(date, integer) to anon, authenticated;
