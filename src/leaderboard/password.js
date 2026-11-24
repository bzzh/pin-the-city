// Password rules and hashing, shared by the game (instant feedback) and the leaderboard server
// (which hashes and checks). A password lets a player sign in to their nickname on another device.

export const MIN_PASSWORD = 6;
export const MAX_PASSWORD = 100;

// Returns a message explaining what's wrong, or null if the password is acceptable.
export function checkPassword(raw) {
  const password = String(raw ?? '');
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters.`;
  return null;
}

// PBKDF2-SHA256: deliberately slow, so a stolen hash can't be guessed quickly (~70 ms per check).
const ITERATIONS = 600_000;

const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((pair) => parseInt(pair, 16)));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

// → "pbkdf2-sha256$<iterations>$<salt hex>$<hash hex>"; the iterations are stored so they can
// be raised later without breaking existing passwords.
export async function hashPassword(password, { iterations = ITERATIONS } = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${iterations}$${toHex(salt)}$${toHex(await derive(password, salt, iterations))}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = String(stored ?? '').split('$');
  if (scheme !== 'pbkdf2-sha256' || !hash) return false;
  const actual = await derive(String(password ?? ''), fromHex(salt), Number(iterations));
  const expected = fromHex(hash);
  // Compare every byte, so the time taken doesn't reveal how much matched.
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}
