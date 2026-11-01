// Leaderboard server function (Supabase Edge Function, runs on Deno).
//
//   POST { action: 'register', nickname }                              → { playerId, token, nickname }
//   POST { action: 'submit', playerId, token, dateKey, picks, guesses } → { points }
//
// Scores are never taken from the browser: the function rebuilds that day's rounds from the
// game's own code and city data and recalculates the score from the raw picks and map taps.
// The shared game code is copied into ../_shared by `npm run sync:server` before deploying.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { categories } from '../_shared/categories/categories.js';
import { isCurrentDateKey } from '../_shared/game/daily.js';
import { scoreSubmission } from '../_shared/leaderboard/verify.js';
import { checkNickname, cleanNickname, nicknameKey } from '../_shared/leaderboard/nickname.js';

// The live game, whose cities.json the players' browsers use too.
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://bzzh.github.io/pin-the-city/';
const CITIES_CACHE_MS = 10 * 60 * 1000;
const UNIQUE_VIOLATION = '23505';

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

async function register(body: Record<string, unknown>) {
  const problem = checkNickname(body.nickname);
  if (problem) return reply(400, { error: problem });

  const nickname = cleanNickname(body.nickname);
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const { data, error } = await db
    .from('players')
    .insert({ nickname, nickname_key: nicknameKey(nickname), token_hash: await sha256(token) })
    .select('id')
    .single();
  if (error?.code === UNIQUE_VIOLATION) return reply(409, { error: 'That nickname is already taken.' });
  if (error) throw error;
  return reply(200, { playerId: data.id, token, nickname });
}

async function submit(body: Record<string, unknown>) {
  const { playerId, token, dateKey, picks, guesses } = body;
  if (typeof playerId !== 'string' || typeof token !== 'string') return reply(401, { error: 'Unknown player.' });

  const { data: player } = await db.from('players').select('id, token_hash').eq('id', playerId).maybeSingle();
  if (!player || player.token_hash !== (await sha256(token))) return reply(401, { error: 'Unknown player.' });

  if (!isCurrentDateKey(dateKey)) return reply(400, { error: "Only today's challenge can be submitted." });

  let points: number;
  try {
    ({ total: points } = scoreSubmission({ cities: await loadCities(), categories, dateKey, picks, guesses }));
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
  try {
    const body = await request.json();
    if (body?.action === 'register') return await register(body);
    if (body?.action === 'submit') return await submit(body);
    return reply(400, { error: 'Unknown action.' });
  } catch (problem) {
    console.error(problem);
    return reply(500, { error: 'Something went wrong on the leaderboard server.' });
  }
});
