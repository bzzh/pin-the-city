// The daily challenge: everyone who plays on the same (local) date gets the same five rounds,
// because the rounds are picked with a random generator seeded from the date.

const FIRST_DAY = Date.UTC(2026, 10, 1); // challenge #1 = 1 November 2026
const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-11-01" for the player's local calendar date.
export function dateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const keyToUtc = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};
const utcToKey = (ms) => new Date(ms).toISOString().slice(0, 10);

// Challenge number shown in the share text: #1 on the first day, #2 the next...
export function dayNumber(key) {
  return Math.round((keyToUtc(key) - FIRST_DAY) / DAY_MS) + 1;
}

// The Monday that starts the week containing this date ("2026-11-04" → "2026-11-02").
export function weekStartKey(key) {
  const ms = keyToUtc(key);
  const daysSinceMonday = (new Date(ms).getUTCDay() + 6) % 7;
  return utcToKey(ms - daysSinceMonday * DAY_MS);
}

// The seven date keys of the week starting on this Monday.
export const weekKeys = (mondayKey) =>
  Array.from({ length: 7 }, (_, i) => utcToKey(keyToUtc(mondayKey) + i * DAY_MS));

// True if this date is "today" somewhere on Earth (time zones run from UTC−12 to UTC+14),
// i.e. a player could legitimately be playing that day's challenge right now.
export function isCurrentDateKey(key, now = new Date()) {
  if (typeof key !== 'string' || !DATE_KEY.test(key) || utcToKey(keyToUtc(key)) !== key) return false;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(keyToUtc(key) - todayUtc) <= DAY_MS;
}

// A small, fast seeded random generator (mulberry32): same seed, same sequence, on every device.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Turns a date key into a seed (FNV-1a string hash).
export function seedFromKey(key) {
  let hash = 0x811c9dc5;
  for (const char of key) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export const dailyRandom = (key) => seededRandom(seedFromKey(key));
