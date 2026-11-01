// Remembers today's daily result in this browser, so it can be played once and shared later.
// Storage can be unavailable (private mode, blocked site data), so every call may quietly fail.
const KEY_PREFIX = 'pin-the-city:daily:';

// → { records, submitted } or null. `submitted` is true once the leaderboard has the score.
export function loadDaily(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY_PREFIX + key));
    if (!saved) return null;
    // Results saved before the leaderboard existed are a bare list of records.
    return Array.isArray(saved) ? { records: saved, submitted: false } : saved;
  } catch {
    return null;
  }
}

export function saveDaily(key, daily) {
  try {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(daily));
  } catch {
    // Not saved: the player could replay today's challenge, which is harmless.
  }
}
