import { describe, expect, it } from 'vitest';
import { buildShareText, placementSquare, roundSquare } from '../src/game/share.js';

const record = (correct, placePoints) => ({ correct, placePoints, points: (correct ? 500 : 0) + placePoints });
const bet = (correct, level, hit, placePoints) => ({ ...record(correct, hit ? placePoints : 0), level, hit });

describe('placementSquare', () => {
  it('colours placements from green to red', () => {
    expect(placementSquare(1500)).toBe('🟩');
    expect(placementSquare(1200)).toBe('🟩');
    expect(placementSquare(800)).toBe('🟨');
    expect(placementSquare(400)).toBe('🟧');
    expect(placementSquare(50)).toBe('🟥');
  });
});

describe('roundSquare', () => {
  it('shows the confidence level that was hit, or a miss', () => {
    expect(roundSquare(bet(true, 'uncertain', true, 250))).toBe('🟥');
    expect(roundSquare(bet(true, 'certain', true, 1000))).toBe('🟩');
    expect(roundSquare(bet(true, 'pinpoint', true, 1500))).toBe('🟦');
    expect(roundSquare(bet(true, 'pinpoint', false))).toBe('⬛');
  });

  it('falls back to distance colours for rounds without a level', () => {
    expect(roundSquare(record(true, 800))).toBe('🟨');
  });
});

describe('buildShareText', () => {
  it('shows the challenge number, total and one mark per round', () => {
    const text = buildShareText({
      number: 12,
      records: [bet(true, 'pinpoint', true, 1500), bet(false, 'confident', true, 750), bet(true, 'safe', false)],
      maxPoints: 6000,
      url: 'https://example.com/pin-the-city/',
    });
    expect(text).toBe(
      'Pin the City #12 · 3,250 / 6,000\n✅🟦 ❌🟨 ✅⬛\nhttps://example.com/pin-the-city/',
    );
  });

  it('never reveals the cities', () => {
    const text = buildShareText({ number: 1, records: [{ ...record(true, 1500), city: 'Cairo' }], maxPoints: 2000 });
    expect(text).not.toContain('Cairo');
  });
});
