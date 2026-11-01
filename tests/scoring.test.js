import { describe, expect, it } from 'vitest';
import {
  CHOICE_POINTS,
  CONFIDENCE_LEVELS,
  LEGACY_MAX_PLACE_POINTS,
  MAX_PLACE_POINTS,
  choicePoints,
  confidenceLevel,
  confidencePoints,
  isHit,
  placementParts,
  distanceKm,
  placementPoints,
  usesConfidence,
} from '../src/game/scoring.js';

const paris = { lat: 48.8566, lng: 2.3522 };
const london = { lat: 51.5074, lng: -0.1278 };

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm(paris, paris)).toBe(0);
  });

  it('measures Paris to London at about 344 km', () => {
    expect(distanceKm(paris, london)).toBeGreaterThan(340);
    expect(distanceKm(paris, london)).toBeLessThan(348);
  });

  it('takes the short way across the antimeridian', () => {
    const fiji = { lat: -17.7, lng: 178 };
    const samoa = { lat: -13.8, lng: -172 };
    expect(distanceKm(fiji, samoa)).toBeLessThan(1500);
  });
});

describe('placementPoints', () => {
  it('gives full points within the perfect radius', () => {
    expect(placementPoints(0)).toBe(LEGACY_MAX_PLACE_POINTS);
    expect(placementPoints(25)).toBe(LEGACY_MAX_PLACE_POINTS);
  });

  it('drops as the guess gets further away', () => {
    expect(placementPoints(500)).toBeLessThan(placementPoints(100));
    expect(placementPoints(20000)).toBeLessThan(5);
  });
});

describe('choicePoints', () => {
  it('rewards only a correct pick: 50 points, or 500 in old daily challenges', () => {
    expect(choicePoints(true)).toBe(CHOICE_POINTS);
    expect(CHOICE_POINTS).toBe(50);
    expect(choicePoints(true, true)).toBe(500);
    expect(choicePoints(false)).toBe(0);
  });
});

describe('confidencePoints', () => {
  const level = (id) => confidenceLevel(id);
  // The base placement score, out of 100.
  const base = (km) => (km <= 25 ? 100 : 100 * Math.exp(-(km - 25) / 2000));

  it('has three levels: smaller circles are bigger bets', () => {
    expect(CONFIDENCE_LEVELS.map((l) => l.radiusKm)).toEqual([500, 150, 25]);
    expect(CONFIDENCE_LEVELS.map((l) => l.win)).toEqual([1.1, 1.3, 1.5]);
    expect(CONFIDENCE_LEVELS.map((l) => l.lose)).toEqual([0.9, 0.7, 0.5]);
  });

  it('multiplies the base score up when the city is within the circle, exactly as shown', () => {
    expect(confidencePoints(level('confident'), 0)).toBe(130);
    expect(confidencePoints(level('confident'), 150)).toBe(Math.round(base(150) * 1.3));
    expect(confidencePoints(level('confident'), 151)).toBe(Math.round(base(151) * 0.7));
  });

  it('keeps the betting rules at every distance', () => {
    for (let km = 0; km <= 20000; km += 0.5) {
      const results = CONFIDENCE_LEVELS.map((l) => ({ points: confidencePoints(l, km), hit: isHit(l, km) }));
      const hits = results.filter((r) => r.hit);
      const misses = results.filter((r) => !r.hit);
      // 1. A hit always beats a miss.
      for (const hit of hits) for (const miss of misses) expect(hit.points, `${km} km`).toBeGreaterThan(miss.points);
      // 2. A miss costs less on a safer bet (levels go from safest to boldest).
      for (let i = 1; i < misses.length; i++) expect(misses[i].points, `${km} km`).toBeLessThanOrEqual(misses[i - 1].points);
      // 3. A hit pays more on a bolder bet.
      for (let i = 1; i < hits.length; i++) expect(hits[i].points, `${km} km`).toBeGreaterThan(hits[i - 1].points);
    }
  });

  it('multiplies the base score down for a miss', () => {
    expect(confidencePoints(level('safe'), 2000)).toBe(Math.round(base(2000) * 0.9));
    expect(confidencePoints(level('pinpoint'), 2000)).toBe(Math.round(base(2000) * 0.5));
    expect(confidencePoints(level('pinpoint'), 20000)).toBe(0);
  });

  it('splits a placement into accuracy and a bet bonus or malus that add up', () => {
    for (const l of CONFIDENCE_LEVELS) {
      for (let km = 0; km <= 20000; km += 7) {
        const { accuracy, bet } = placementParts(l, km);
        expect(accuracy + bet).toBe(confidencePoints(l, km));
        expect(accuracy).toBe(Math.round(base(km)));
        // A hit never loses points and a miss never gains any (tiny scores can round to 0).
        if (isHit(l, km)) expect(bet).toBeGreaterThanOrEqual(0);
        else expect(bet).toBeLessThanOrEqual(0);
      }
    }
  });

  it('reaches the maximum only with a Pinpoint hit', () => {
    expect(confidencePoints(level('pinpoint'), 25)).toBe(MAX_PLACE_POINTS);
    for (const other of CONFIDENCE_LEVELS.filter((l) => l.id !== 'pinpoint')) {
      expect(confidencePoints(other, 0)).toBeLessThan(MAX_PLACE_POINTS);
    }
  });

  it('starts with the daily challenge of 2 November 2026', () => {
    expect(usesConfidence('2026-11-01')).toBe(false);
    expect(usesConfidence('2026-11-02')).toBe(true);
  });
});
