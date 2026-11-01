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

  it('has four levels whose circles shrink as the points grow', () => {
    expect(CONFIDENCE_LEVELS.map((l) => l.radiusKm)).toEqual([500, 250, 125, 0]);
    expect(CONFIDENCE_LEVELS.map((l) => l.points)).toEqual([500, 750, 1000, 1500]);
  });

  it('pays the level when the city touches the circle, allowing 25 km for the city', () => {
    expect(confidencePoints(level('confident'), 0)).toBe(750);
    expect(confidencePoints(level('confident'), 275)).toBe(750);
    expect(confidencePoints(level('confident'), 276)).toBeLessThan(750);
  });

  it('pays a quarter of the distance score for a miss, the same at every level', () => {
    expect(confidencePoints(level('confident'), 1000)).toBe(Math.round(placementPoints(1000) / 4));
    expect(confidencePoints(level('pinpoint'), 1000)).toBe(confidencePoints(level('safe'), 1000));
    expect(confidencePoints(level('pinpoint'), 20000)).toBe(0);
  });

  it('never pays more for a miss than for any hit', () => {
    const smallestHit = Math.min(...CONFIDENCE_LEVELS.map((l) => l.points));
    expect(confidencePoints(level('pinpoint'), 26)).toBeLessThan(smallestHit);
  });

  it('pays Pinpoint only within the city itself', () => {
    expect(confidencePoints(level('pinpoint'), 25)).toBe(MAX_PLACE_POINTS);
    expect(confidencePoints(level('pinpoint'), 26)).toBeLessThan(400);
  });

  it('starts with the daily challenge of 2 November 2026', () => {
    expect(usesConfidence('2026-11-01')).toBe(false);
    expect(usesConfidence('2026-11-02')).toBe(true);
  });
});
