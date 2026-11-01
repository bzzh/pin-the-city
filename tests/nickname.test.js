import { describe, expect, it } from 'vitest';
import { checkNickname, cleanNickname, nicknameKey } from '../src/leaderboard/nickname.js';

describe('checkNickname', () => {
  it('accepts ordinary names in any alphabet', () => {
    for (const name of ['bzzh', 'Hélène', 'Map_Master-3', 'J. Doe', 'Ōsaka fan', 'Habite', 'Constance', 'Bassem']) {
      expect(checkNickname(name), name).toBeNull();
    }
  });

  it('enforces length and characters', () => {
    expect(checkNickname('ab')).toMatch(/3 to 20/);
    expect(checkNickname('a'.repeat(21))).toMatch(/3 to 20/);
    expect(checkNickname('hi<script>')).toMatch(/only letters/);
    expect(checkNickname('12345')).toMatch(/at least one letter/);
  });

  it('blocks offensive names, including disguised ones', () => {
    for (const name of ['fuck', 'xXFuckXx', 'f u c k', 'sh1t head', 'Putain', 'Enculé', 'big pute']) {
      expect(checkNickname(name), name).toMatch(/different nickname/);
    }
  });
});

describe('nicknameKey', () => {
  it('treats case, accents and separators as the same name', () => {
    expect(nicknameKey('Hélène')).toBe(nicknameKey('helene'));
    expect(nicknameKey('Map Master')).toBe(nicknameKey('map_master'));
    expect(nicknameKey('bzzh')).not.toBe(nicknameKey('bzzh2'));
  });
});

describe('cleanNickname', () => {
  it('trims and collapses spaces', () => {
    expect(cleanNickname('  Bz   zh ')).toBe('Bz zh');
  });
});
