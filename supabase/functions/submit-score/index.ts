// Leaderboard server function (Supabase Edge Function, runs on Deno).
//
//   POST { action: 'register', nickname }                                  → { playerId, token, nickname }
//   POST { action: 'submit', playerId, token, dateKey, picks, guesses, levels } → { points }
//   POST { action: 'set-password', playerId, token, password }             → { ok }
//   POST { action: 'sign-in', nickname, password }                         → { playerId, token, nickname }
//   POST { action: 'merge', playerId, token, nickname, password }          → { playerId, token, nickname }
//
// `token` is the secret key a browser keeps to prove it plays as that player; each device has
// its own. A password lets a player sign in to their nickname on another device ('sign-in'),
// or move the scores of a nickname they no longer want into it ('merge').
//
// Scores are never taken from the browser: the function rebuilds that day's rounds from the
// game's own code and city data and recalculates the score from the raw picks, confidence
// levels and map taps.
// The shared game code is copied into ../_shared by `npm run sync:server` before deploying.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { categories } from '../_shared/categories/categories.js';
import { isCurrentDateKey } from '../_shared/game/daily.js';
import { scoreSubmission } from '../_shared/leaderboard/verify.js';
import { checkNickname, cleanNickname, nicknameKey } from '../_shared/leaderboard/nickname.js';
import { checkPassword, hashPassword, verifyPassword } from '../_shared/leaderboard/password.js';

// The live game, whose cities.json the players' browsers use too.
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://bzzh.github.io/pin-the-city/';
const CITIES_CACHE_MS = 10 * 60 * 1000;
const UNIQUE_VIOLATION = '23505';
// After this many wrong passwords for a nickname, sign-ins to it pause for a while.
const MAX_FAILED_SIGN_INS = 10;
const FAILED_SIGN_IN_WINDOW_MS = 15 * 60 * 1000;

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const UNKNOWN_PLAYER = () => reply(401, { error: 'Unknown player.' });

let citiesCache: { loadedAt: number; cities: unknown[] } | null = null;
async function loadCities() {
  if (citiesCache && Date.now() - citiesCache.loadedAt < CITIES_CACHE_MS) return citiesCache.cities;
  const response = await fetch(new URL('data/cities.json', SITE_URL));
  if (!response.ok) throw new Error(`Could not load cities.json (${response.status})`);
  citiesCache = { loadedAt: Date.now(), cities: await response.json() };
  return citiesCache.cities;
}

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (text: string) =>
  toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));

// Gives a device a new secret key for the player. → { playerId, token, nickname }
async function issueToken(player: { id: string; nickname: string }) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const { error } = await db.from('player_tokens').insert({ token_hash: await sha256(token), player_id: player.id });
  if (error) throw error;
  return { playerId: player.id, token, nickname: player.nickname };
}

// The player whose secret key this is, or null.
async function authenticate(playerId: unknown, token: unknown) {
  if (typeof playerId !== 'string' || typeof token !== 'string') return null;
  const { data } = await db
    .from('player_tokens')
    .select('player_id, players (id, nickname, nickname_key)')
    .eq('token_hash', await sha256(token))
    .maybeSingle();
  return data?.player_id === playerId ? (data.players as { id: string; nickname: string; nickname_key: string }) : null;
}

// Checks a nickname and its password. → { player } or { response } explaining why not.
async function checkSignIn(nickname: unknown, password: unknown) {
  const key = nicknameKey(nickname);
  const since = new Date(Date.now() - FAILED_SIGN_IN_WINDOW_MS).toISOString();
  const { count } = await db
    .from('failed_sign_ins')
    .select('*', { count: 'exact', head: true })
    .eq('nickname_key', key)
    .gte('attempted_at', since);
  if ((count ?? 0) >= MAX_FAILED_SIGN_INS) {
    return { response: reply(429, { error: 'Too many wrong passwords. Try again in 15 minutes.' }) };
  }

  const { data: player } = await db
    .from('players')
    .select('id, nickname, password_hash')
    .eq('nickname_key', key)
    .maybeSingle();
  if (!player) return { response: reply(404, { error: 'No player has that nickname.' }) };
  if (!player.password_hash) {
    return {
      response: reply(403, {
        error: `${player.nickname} has no password yet. On the device where you play as ${player.nickname}, open the leaderboard and choose "Play on other devices".`,
      }),
    };
  }
  if (!(await verifyPassword(password, player.password_hash))) {
    await db.from('failed_sign_ins').insert({ nickname_key: key });
    // Housekeeping: forget attempts older than a day.
    await db.from('failed_sign_ins').delete().lt('attempted_at', new Date(Date.now() - 86_400_000).toISOString());
    return { response: reply(401, { error: 'Wrong password.' }) };
  }
  return { player };
}

async function register(body: Record<string, unknown>) {
  const problem = checkNickname(body.nickname);
  if (problem) return reply(400, { error: problem });

  const nickname = cleanNickname(body.nickname);
  const { data: player, error } = await db
    .from('players')
    .insert({ nickname, nickname_key: nicknameKey(nickname) })
    .select('id, nickname')
    .single();
  if (error?.code === UNIQUE_VIOLATION) return reply(409, { error: 'That nickname is already taken.' });
  if (error) throw error;
  try {
    return reply(200, await issueToken(player!));
  } catch (problem) {
    await db.from('players').delete().eq('id', player.id); // don't leave the nickname taken
    throw problem;
  }
}

async function submit(body: Record<string, unknown>) {
  const { playerId, token, dateKey, picks, guesses, levels } = body;
  const player = await authenticate(playerId, token);
  if (!player) return UNKNOWN_PLAYER();

  if (!isCurrentDateKey(dateKey)) return reply(400, { error: "Only today's challenge can be submitted." });

  let points: number;
  try {
    ({ total: points } = scoreSubmission({ cities: await loadCities(), categories, dateKey, picks, guesses, levels }));
  } catch (problem) {
    return reply(400, { error: (problem as Error).message });
  }

  const { error } = await db.from('daily_scores').insert({ player_id: player.id, day: dateKey, points });
  if (error?.code === UNIQUE_VIOLATION) {
    return reply(409, { error: "Today's score is already on the leaderboard.", alreadySubmitted: true });
  }
  if (error) throw error;
  return reply(200, { points });
}

async function setPassword(body: Record<string, unknown>) {
  const player = await authenticate(body.playerId, body.token);
  if (!player) return UNKNOWN_PLAYER();
  const problem = checkPassword(body.password);
  if (problem) return reply(400, { error: problem });

  const { error } = await db
    .from('players')
    .update({ password_hash: await hashPassword(body.password) })
    .eq('id', player.id);
  if (error) throw error;
  // A new password clears earlier wrong guesses, so the player can sign in at once.
  await db.from('failed_sign_ins').delete().eq('nickname_key', player.nickname_key);
  return reply(200, { ok: true });
}

async function signIn(body: Record<string, unknown>) {
  const { player, response } = await checkSignIn(body.nickname, body.password);
  if (response) return response;
  return reply(200, await issueToken(player!));
}

// Run on the device that plays as the nickname being given up; `nickname` and `password` are
// those of the nickname being kept.
async function merge(body: Record<string, unknown>) {
  const from = await authenticate(body.playerId, body.token);
  if (!from) return UNKNOWN_PLAYER();
  if (nicknameKey(body.nickname) === from.nickname_key) {
    return reply(400, { error: `This device already plays as ${from.nickname}. Enter the other nickname you want to keep.` });
  }
  const { player: into, response } = await checkSignIn(body.nickname, body.password);
  if (response) return response;

  const { error } = await db.rpc('merge_players', { from_player: from.id, into_player: into!.id });
  if (error) throw error;
  return reply(200, await issueToken(into!));
}

const ACTIONS: Record<string, (body: Record<string, unknown>) => Promise<Response>> = {
  register,
  submit,
  'set-password': setPassword,
  'sign-in': signIn,
  merge,
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
  try {
    const body = await request.json();
    const action = ACTIONS[body?.action];
    if (!action) return reply(400, { error: 'Unknown action.' });
    return await action(body);
  } catch (problem) {
    console.error(problem);
    return reply(500, { error: 'Something went wrong on the leaderboard server.' });
  }
});
