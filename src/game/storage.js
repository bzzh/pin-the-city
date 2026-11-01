// Remembers today's daily result in this browser, so it can be played once and shared later.
// Storage can be unavailable (private mode, blocked site data), so every call may quietly fail.
const KEY_PREFIX = 'pin-the-city:daily:';

export function loadDaily(key) {
  try {
    const saved = localStorage.getItem(KEY_PREFIX + key);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function saveDaily(key, records) {
  try {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(records));
  } catch {
    // Not saved: the player could replay today's challenge, which is harmless.
  }
}
