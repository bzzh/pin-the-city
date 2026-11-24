-- Playing on several devices: a nickname can have a password, each device gets its own secret
-- key, and a player can merge a second nickname into the one they keep.
--
-- Run this, then deploy the submit-score function straight away (npm run deploy:server): the
-- old function still expects players.token_hash. Scores that fail to send in between are
-- retried the next time the player opens the game.

-- One secret key per device, instead of one per player.
create table public.player_tokens (
  -- SHA-256 of the secret key kept in that browser; the key itself is never stored.
  token_hash text primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index player_tokens_player_idx on public.player_tokens (player_id);

insert into public.player_tokens (token_hash, player_id)
select token_hash, id from public.players;

alter table public.players drop column token_hash;

-- PBKDF2 hash of the player's password (src/leaderboard/password.js); null until they set one.
alter table public.players add column password_hash text;

-- Wrong passwords, so a nickname's password can't be guessed by trying many times.
create table public.failed_sign_ins (
  nickname_key text not null,
  attempted_at timestamptz not null default now()
);

create index failed_sign_ins_key_idx on public.failed_sign_ins (nickname_key, attempted_at);

-- As with the other tables: no policies, so only the server function (service role) uses them.
alter table public.player_tokens enable row level security;
alter table public.failed_sign_ins enable row level security;

-- Moves every daily score of `from_player` to `into_player`, then deletes `from_player` (which
-- frees its nickname and signs out its devices). If both played the same day, the higher score
-- is kept: scores are never added together.
create or replace function public.merge_players(from_player uuid, into_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if from_player = into_player then
    raise exception 'A player cannot be merged into itself.';
  end if;

  insert into daily_scores (player_id, day, points, created_at)
  select into_player, day, points, created_at
  from daily_scores
  where player_id = from_player
  on conflict (player_id, day) do update
    set points = greatest(daily_scores.points, excluded.points);

  delete from players where id = from_player;
end;
$$;

revoke all on function public.merge_players(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_players(uuid, uuid) to service_role;
