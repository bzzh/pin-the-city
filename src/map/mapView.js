import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const WORLD = L.latLngBounds([-90, -180], [90, 180]);
// Deepest zoom the player may reach; at this level cities show as grey patches.
const MAX_ZOOM = 7;
// Zoom used to frame the answer after a placement.
const ANSWER_ZOOM = 5;
// A pin needs a press and hold (mouse, finger or pen), so a click, tap or scroll can't place it
// by mistake.
const HOLD_MS = 500;
const HOLD_SLOP_PX = 10; // a pointer moving further than this is panning, not holding

// Cloud-free satellite imagery with no borders or labels (EOX Sentinel-2 cloudless), on a flat
// latitude/longitude grid. EOX's "WGS84" tile grid is the same as Leaflet's EPSG:4326 one.
const SATELLITE_TILES = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024/default/WGS84/{z}/{y}/{x}.jpg';
const SATELLITE_CREDIT =
  '<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)';

export function createMap(element, { onPick }) {
  const map = L.map(element, {
    crs: L.CRS.EPSG4326,
    maxBounds: WORLD,
    maxBoundsViscosity: 1,
    maxZoom: MAX_ZOOM,
    zoomSnap: 0.25,
  });

  L.tileLayer(SATELLITE_TILES, {
    bounds: WORLD,
    noWrap: true,
    attribution: SATELLITE_CREDIT,
  }).addTo(map);

  // Never let the player zoom out further than the whole world.
  const fitWorld = () => map.setMinZoom(map.getBoundsZoom(WORLD));
  fitWorld();
  map.fitBounds(WORLD);

  watchHolds(element, (point) => onPick(map.containerPointToLatLng(point)));

  // Redraw when the container changes size (phone address bar, rotated screen, resized panel).
  new ResizeObserver(() => {
    map.invalidateSize();
    fitWorld();
  }).observe(element);

  const css = getComputedStyle(document.documentElement);
  const layer = L.layerGroup().addTo(map);

  // Real-size circles (radius in km), e.g. the player's confidence circle.
  const kmCircle = (center, km, color) =>
    L.circle(center, { radius: km * 1000, color, weight: 2, fillOpacity: 0.1, interactive: false }).addTo(layer);
  let guessCircle = null;

  return {
    // `circleKm` draws the player's confidence circle around the tap (0 for none).
    showGuess(guess, circleKm = 0) {
      layer.clearLayers();
      const guessColor = css.getPropertyValue('--guess').trim();
      guessCircle = circleKm > 0 ? kmCircle(guess, circleKm, guessColor) : null;
      L.circleMarker(guess, { radius: 7, color: guessColor }).addTo(layer);
    },
    // `cityKm` draws the city's own size around the answer (0 for none).
    showAnswer(guess, answer, cityKm = 0) {
      const answerColor = css.getPropertyValue('--answer').trim();
      L.polyline([guess, answer], { color: answerColor, dashArray: '6 6', weight: 2 }).addTo(layer);
      if (cityKm > 0) kmCircle(answer, cityKm, answerColor);
      L.circleMarker(answer, { radius: 7, color: answerColor }).addTo(layer);
      // Show the whole confidence circle too. Extra bottom padding keeps it all clear of the result card.
      const bounds = L.latLngBounds([guess, answer]);
      if (guessCircle) bounds.extend(guessCircle.getBounds());
      map.fitBounds(bounds, {
        paddingTopLeft: [50, 50],
        paddingBottomRight: [50, 180],
        maxZoom: ANSWER_ZOOM,
      });
    },
    // Removes the markers and zooms back out to the whole world for the next round.
    reset() {
      layer.clearLayers();
      map.fitBounds(WORLD);
    },
    // Blurs the map and stops it being moved or zoomed, so it can't help answer the
    // multiple-choice question (e.g. "Furthest north").
    setBlurred(blurred) {
      element.classList.toggle('blurred', blurred);
      element.inert = blurred;
    },
  };
}

// Calls onHold(point in the container) when one pointer (a mouse button, finger or pen) stays
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
    const point = L.point(event.clientX - box.left, event.clientY - box.top);
    hold = {
      id: event.pointerId,
      start: [event.clientX, event.clientY],
      timer: setTimeout(() => {
        cancel();
        navigator.vibrate?.(15);
        onHold(point);
      }, HOLD_MS),
    };
    ring.style.left = `${point.x}px`;
    ring.style.top = `${point.y}px`;
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
