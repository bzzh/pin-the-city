// The player's leaderboard identity, kept in this browser: { playerId, token, nickname }.
// The token proves the scores are theirs; losing it (new device, cleared data) means a new player.
const KEY = 'pin-the-city:player';

export function loadPlayer() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved?.playerId && saved?.token ? saved : null;
  } catch {
    return null;
  }
}

export function savePlayer(player) {
  try {
    localStorage.setItem(KEY, JSON.stringify(player));
  } catch {
    // Not saved: the player can still submit today, but will be asked for a nickname again.
  }
}
