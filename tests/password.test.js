import { describe, expect, it } from 'vitest';
import { checkPassword, hashPassword, verifyPassword } from '../src/leaderboard/password.js';

describe('checkPassword', () => {
  it('needs 6 to 100 characters', () => {
    expect(checkPassword('12345')).toMatch(/at least 6/);
    expect(checkPassword('123456')).toBeNull();
    expect(checkPassword('x'.repeat(101))).toMatch(/at most 100/);
    expect(checkPassword(undefined)).toMatch(/at least 6/);
  });
});

describe('hashPassword / verifyPassword', () => {
  // Few iterations keep the test fast; verifyPassword reads them from the stored hash.
  const fast = { iterations: 1000 };

  it('accepts the right password and rejects others', async () => {
    const stored = await hashPassword('grathon rocks', fast);
    expect(stored).toMatch(/^pbkdf2-sha256\$1000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPassword('grathon rocks', stored)).toBe(true);
    expect(await verifyPassword('Grathon rocks', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('salts each hash differently', async () => {
    expect(await hashPassword('same', fast)).not.toBe(await hashPassword('same', fast));
  });

  it('rejects missing or malformed hashes', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', 'nonsense')).toBe(false);
  });
});
