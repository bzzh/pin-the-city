import { SUPABASE_KEY, SUPABASE_URL } from './config.js';

export const leaderboardEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

const headers = {
  apikey: SUPABASE_KEY,
  'Content-Type': 'application/json',
  // Older "anon" keys are JWTs and also go in Authorization; newer publishable keys don't.
  ...(SUPABASE_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
};

// POSTs JSON and returns the parsed reply. Failed requests throw an Error whose message is
// the server's explanation, with `status` and the reply's `data` attached.
async function post(path, body) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? data.message ?? `Leaderboard request failed (${response.status}).`);
    Object.assign(error, { status: response.status, data });
    throw error;
  }
  return data;
}

// → { playerId, token, nickname }; throws with status 409 if the nickname is taken.
export const register = (nickname) => post('/functions/v1/submit-score', { action: 'register', nickname });

// Sends a finished daily's raw answers; the server re-scores them. → { points }
export const submitDaily = (player, dateKey, records) =>
  post('/functions/v1/submit-score', {
    action: 'submit',
    playerId: player.playerId,
    token: player.token,
    dateKey,
    picks: records.map((record) => record.pick),
    guesses: records.map((record) => record.guess),
  });

// → [{ rank, nickname, days_played, total }] for the week starting on that Monday.
export const fetchWeekly = (weekStart) =>
  post('/rest/v1/rpc/weekly_leaderboard', { week_start: weekStart, max_rows: 10 });
