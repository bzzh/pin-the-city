import { describe, expect, it } from 'vitest';
import {
  CHOICE_POINTS,
  MAX_PLACE_POINTS,
  choicePoints,
  distanceKm,
  placementPoints,
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
