import { describe, expect, it } from 'vitest';
import { buildShareText } from '../src/game/share.js';

const URL_BASE = 'https://example.com/pin-the-city/';
// A round with a bet: placement points are out of 150.
const round = (correct, placePoints) => ({ correct, placePoints, level: 'safe', points: (correct ? 50 : 0) + placePoints });

describe('buildShareText', () => {
  const records = [round(true, 132), round(false, 86), round(true, 150)];

  it('shows the total, then each choice and placement out of 150, then the address', () => {
    const text = buildShareText({ number: 12, records, maxPoints: 600, url: URL_BASE });
    expect(text).toBe(['📍 Pin the City #12 · 468 / 600', '✅ 132 · ❌ 86 · ✅ 150', URL_BASE].join('\n'));
  });

  it('scales rounds from before confidence levels down to 150', () => {
    const old = [{ correct: true, placePoints: 1234, points: 1734 }];
    expect(buildShareText({ number: 1, records: old, maxPoints: 2000 }).split('\n')[1]).toBe('✅ 123');
  });

  it('never reveals the cities or the questions', () => {
    const named = records.map((r) => ({ ...r, city: 'Cairo', category: 'Most populous' }));
    const text = buildShareText({ number: 1, records: named, maxPoints: 600, url: URL_BASE });
    expect(text).not.toContain('Cairo');
    expect(text).not.toContain('populous');
  });
});
