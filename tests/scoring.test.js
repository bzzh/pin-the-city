import { describe, expect, it } from 'vitest';
import {
  CHOICE_POINTS,
  CONFIDENCE_LEVELS,
  MAX_PLACE_POINTS,
  choicePoints,
  confidenceLevel,
  confidencePoints,
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
    expect(placementPoints(0)).toBe(MAX_PLACE_POINTS);
    expect(placementPoints(25)).toBe(MAX_PLACE_POINTS);
  });

  it('drops as the guess gets further away', () => {
    expect(placementPoints(500)).toBeLessThan(placementPoints(100));
    expect(placementPoints(20000)).toBeLessThan(5);
  });
});

describe('choicePoints', () => {
  it('rewards only a correct pick', () => {
    expect(choicePoints(true)).toBe(CHOICE_POINTS);
    expect(choicePoints(false)).toBe(0);
  });
});

describe('confidencePoints', () => {
  const level = (id) => confidenceLevel(id);
  // The base placement score, out of 1,000.
  const base = (km) => (km <= 25 ? 1000 : 1000 * Math.exp(-(km - 25) / 2000));

  it('has four levels: smaller circles are bigger bets', () => {
    expect(CONFIDENCE_LEVELS.map((l) => l.radiusKm)).toEqual([500, 250, 125, 0]);
    expect(CONFIDENCE_LEVELS.map((l) => l.win)).toEqual([1.1, 1.2, 1.3, 1.5]);
    expect(CONFIDENCE_LEVELS.map((l) => l.lose)).toEqual([0.9, 0.8, 0.7, 0.5]);
  });

  it('multiplies the base score up when the city touches the circle, allowing 25 km for the city', () => {
    expect(confidencePoints(level('confident'), 0)).toBe(1200);
    expect(confidencePoints(level('confident'), 275)).toBe(Math.round(base(275) * 1.2));
    expect(confidencePoints(level('confident'), 276)).toBe(Math.round(base(276) * 0.8));
  });

  it('multiplies the base score down for a miss', () => {
    expect(confidencePoints(level('safe'), 2000)).toBe(Math.round(base(2000) * 0.9));
    expect(confidencePoints(level('pinpoint'), 2000)).toBe(Math.round(base(2000) * 0.5));
    expect(confidencePoints(level('pinpoint'), 20000)).toBe(0);
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
