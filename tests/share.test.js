import { describe, expect, it } from 'vitest';
import { buildShareText, placementSquare } from '../src/game/share.js';

const record = (correct, placePoints) => ({ correct, placePoints, points: (correct ? 500 : 0) + placePoints });

describe('placementSquare', () => {
  it('colours placements from green to red', () => {
    expect(placementSquare(1500)).toBe('🟩');
    expect(placementSquare(1200)).toBe('🟩');
    expect(placementSquare(800)).toBe('🟨');
    expect(placementSquare(400)).toBe('🟧');
    expect(placementSquare(50)).toBe('🟥');
  });
});

describe('buildShareText', () => {
  it('shows the challenge number, total and one mark per round', () => {
    const text = buildShareText({
      number: 12,
      records: [record(true, 1500), record(false, 800), record(true, 50)],
      maxPoints: 6000,
      url: 'https://example.com/pin-the-city/',
    });
    expect(text).toBe(
      'Pin the City #12 · 3,350 / 6,000\n✅🟩 ❌🟨 ✅🟥\nhttps://example.com/pin-the-city/',
    );
  });

  it('never reveals the cities', () => {
    const text = buildShareText({ number: 1, records: [{ ...record(true, 1500), city: 'Cairo' }], maxPoints: 2000 });
    expect(text).not.toContain('Cairo');
  });
});
