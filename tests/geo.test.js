import { describe, expect, it } from 'vitest';
import { distanceKm } from '../src/game/scoring.js';
import { circle, destination, greatCircle, unwrap } from '../src/map/geo.js';

const moscow = { lat: 55.75, lng: 37.62 };
const fiji = { lat: -17.7, lng: 178 };
const samoa = { lat: -13.8, lng: -172 };

describe('destination and circle', () => {
  it('lands exactly the requested distance away, even far north', () => {
    for (const bearing of [0, 45, 90, 180, 270]) {
      expect(distanceKm(moscow, destination(moscow, 150, bearing))).toBeCloseTo(150, 6);
    }
  });

  it('draws a closed ring of points all the same distance from the centre', () => {
    const ring = circle(moscow, 500);
    expect(ring[0].lat).toBeCloseTo(ring.at(-1).lat, 9);
    for (const point of ring) expect(distanceKm(moscow, point)).toBeCloseTo(500, 6);
  });
});

describe('greatCircle', () => {
  it('starts and ends at the two places, with every step on the shortest path', () => {
    const path = greatCircle(moscow, fiji);
    expect(distanceKm(path[0], moscow)).toBeLessThan(0.001);
    expect(distanceKm(path.at(-1), fiji)).toBeLessThan(0.001);
    const steps = path.slice(1).map((point, i) => distanceKm(path[i], point));
    const total = steps.reduce((sum, step) => sum + step, 0);
    expect(total).toBeCloseTo(distanceKm(moscow, fiji), 0);
  });
});

describe('unwrap', () => {
  it('keeps a line across the date line in one piece', () => {
    const lngs = unwrap(greatCircle(fiji, samoa)).map((point) => point.lng);
    for (let i = 1; i < lngs.length; i++) expect(Math.abs(lngs[i] - lngs[i - 1])).toBeLessThan(10);
  });
});
