import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { circle, greatCircle, unwrap } from './geo.js';

// Deepest zoom the player may reach; at this level cities show as grey patches.
const MAX_ZOOM = 8;
// Deepest zoom used to frame the answer after a placement.
const ANSWER_ZOOM = 6;
// A pin needs a press and hold (mouse, finger or pen), so a click, tap or scroll can't place it
// by mistake.
const HOLD_MS = 500;
const HOLD_SLOP_PX = 10; // a pointer moving further than this is panning, not holding

// Cloud-free satellite imagery with no borders or labels (EOX Sentinel-2 cloudless), wrapped
// on a globe so northern regions keep their true size.
const SATELLITE_TILES = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg';
const SATELLITE_CREDIT =
  '<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)';

const EMPTY = { type: 'FeatureCollection', features: [] };
const lngLat = ({ lat, lng }) => [lng, lat];
const feature = (geometry) => ({ type: 'Feature', properties: {}, geometry });

// The zoom at which the whole globe fits the container with a small margin. At zoom z the globe
// is 512·2^z / π pixels across.
const globeZoom = (element) => Math.log2((Math.min(element.clientWidth, element.clientHeight) * 0.9 * Math.PI) / 512);

export function createMap(element, { onPick }) {
  const css = getComputedStyle(document.documentElement);
  const color = (name) => css.getPropertyValue(name).trim();

  const map = new maplibregl.Map({
    container: element,
    style: {
      version: 8,
      projection: { type: 'globe' },
      // A soft atmosphere around the globe while zoomed out.
      sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 4, 0.6, 6, 0] },
      sources: {
        satellite: { type: 'raster', tiles: [SATELLITE_TILES], tileSize: 256, maxzoom: 14, attribution: SATELLITE_CREDIT },
        circle: { type: 'geojson', data: EMPTY },
        line: { type: 'geojson', data: EMPTY },
        guess: { type: 'geojson', data: EMPTY },
        answer: { type: 'geojson', data: EMPTY },
      },
      layers: [
        { id: 'satellite', type: 'raster', source: 'satellite' },
        { id: 'circle-fill', type: 'fill', source: 'circle', paint: { 'fill-color': color('--guess'), 'fill-opacity': 0.12 } },
        { id: 'circle-edge', type: 'line', source: 'circle', paint: { 'line-color': color('--guess'), 'line-width': 2 } },
        { id: 'line', type: 'line', source: 'line', paint: { 'line-color': color('--answer'), 'line-width': 2, 'line-dasharray': [3, 3] } },
        ...['guess', 'answer'].map((id) => ({
          id,
          type: 'circle',
          source: id,
          paint: {
            'circle-radius': 7,
            'circle-color': color(id === 'guess' ? '--guess' : '--answer'),
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        })),
      ],
    },
    center: [10, 25],
    zoom: globeZoom(element),
    maxZoom: MAX_ZOOM,
    maxPitch: 0,
    dragRotate: false,
    pitchWithRotate: false,
    attributionControl: { compact: true },
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

  // Never let the player zoom out further than the whole globe.
  const fitGlobe = () => map.setMinZoom(globeZoom(element));
  fitGlobe();

  // Sources exist once the style has loaded; draw calls before that wait for it.
  const ready = new Promise((resolve) => map.once('load', resolve));
  // Keep the imagery credit folded behind its ⓘ button so it doesn't cover the map on phones.
  ready.then(() => element.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
  const setData = (id, data) => ready.then(() => map.getSource(id).setData(data));
  const clear = () => ['circle', 'line', 'guess', 'answer'].forEach((id) => setData(id, EMPTY));

  watchHolds(element, (point) => {
    const at = map.unproject(point);
    // A point in space beside the globe has no place on Earth: projecting it back misses.
    const back = map.project(at);
    if (Math.hypot(back.x - point[0], back.y - point[1]) > 2) return;
    onPick({ lat: at.lat, lng: at.lng });
  });

  // Redraw when the container changes size (phone address bar, rotated screen, resized panel).
  new ResizeObserver(() => {
    map.resize();
    fitGlobe();
  }).observe(element);

  let guessRing = null;

  return {
    // `circleKm` draws the player's bet circle around the pin (0 for none).
    showGuess(guess, circleKm = 0) {
      clear();
      guessRing = circleKm > 0 ? unwrap(circle(guess, circleKm)) : null;
      if (guessRing) setData('circle', feature({ type: 'Polygon', coordinates: [guessRing.map(lngLat)] }));
      setData('guess', feature({ type: 'Point', coordinates: lngLat(guess) }));
    },
    // `bottom` is the space to keep clear at the bottom, e.g. for the result card.
    showAnswer(guess, answer, { bottom = 200 } = {}) {
      const path = unwrap(greatCircle(guess, answer));
      setData('line', feature({ type: 'LineString', coordinates: path.map(lngLat) }));
      setData('answer', feature({ type: 'Point', coordinates: lngLat(path.at(-1)) }));
      // Frame the pin, the city and the whole bet circle above the bottom space.
      const bounds = new maplibregl.LngLatBounds();
      for (const point of [...path, ...(guessRing ?? [])]) bounds.extend(lngLat(point));
      map.fitBounds(bounds, { padding: { top: 50, left: 50, right: 50, bottom: Math.min(bottom, element.clientHeight * 0.6) }, maxZoom: ANSWER_ZOOM, duration: 800 });
    },
    // Removes the markers and turns back to the whole globe for the next round.
    reset() {
      clear();
      guessRing = null;
      map.jumpTo({ zoom: globeZoom(element) });
    },
    // Blurs the map and stops it being moved or zoomed, so it can't help answer the
    // multiple-choice question (e.g. "Furthest north").
    setBlurred(blurred) {
      element.classList.toggle('blurred', blurred);
      element.inert = blurred;
    },
  };
}

// Calls onHold([x, y] in the container) when one pointer (a mouse button, finger or pen) stays
// still on the map for HOLD_MS. A ring fills up underneath meanwhile; moving, releasing or a
// second finger cancels it.
function watchHolds(element, onHold) {
  const ring = document.createElement('div');
  ring.className = 'hold-ring';
  ring.hidden = true;
  element.append(ring);
  const fingers = new Set();
  let hold = null;

  const cancel = () => {
    if (!hold) return;
    clearTimeout(hold.timer);
    hold = null;
    ring.hidden = true;
  };

  element.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return; // left button only
    fingers.add(event.pointerId);
    cancel();
    if (fingers.size > 1) return; // pinch to zoom
    const box = element.getBoundingClientRect();
    const point = [event.clientX - box.left, event.clientY - box.top];
    hold = {
      id: event.pointerId,
      start: [event.clientX, event.clientY],
      timer: setTimeout(() => {
        cancel();
        navigator.vibrate?.(15);
        onHold(point);
      }, HOLD_MS),
    };
    ring.style.left = `${point[0]}px`;
    ring.style.top = `${point[1]}px`;
    ring.style.setProperty('--hold-ms', `${HOLD_MS}ms`);
    ring.hidden = false;
    ring.classList.remove('filling');
    void ring.offsetWidth; // restart the fill animation
    ring.classList.add('filling');
  });

  element.addEventListener('pointermove', (event) => {
    if (!hold || event.pointerId !== hold.id) return;
    const [x, y] = hold.start;
    if (Math.hypot(event.clientX - x, event.clientY - y) > HOLD_SLOP_PX) cancel();
  });

  const lift = (event) => {
    fingers.delete(event.pointerId);
    if (hold && event.pointerId === hold.id) cancel();
  };
  element.addEventListener('pointerup', lift);
  element.addEventListener('pointercancel', lift);
  // A long press would otherwise open the browser's own menu or text selection.
  element.addEventListener('contextmenu', (event) => event.preventDefault());
}
