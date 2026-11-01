import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const WORLD = L.latLngBounds([-90, -180], [90, 180]);
// Highest zoom with real tiles (see scripts/build-tiles.js); beyond it Leaflet enlarges them.
const MAX_TILE_ZOOM = 5;

// A physical world map with no borders or labels: Natural Earth II relief, land cover and
// rivers, on a flat latitude/longitude grid.
export function createMap(element, { onPick }) {
  const map = L.map(element, {
    crs: L.CRS.EPSG4326,
    maxBounds: WORLD,
    maxBoundsViscosity: 1,
    maxZoom: MAX_TILE_ZOOM + 2,
    zoomSnap: 0.25,
  });

  L.tileLayer('tiles/{z}/{x}/{y}.webp', {
    bounds: WORLD,
    noWrap: true,
    maxNativeZoom: MAX_TILE_ZOOM,
    attribution: 'Map: <a href="https://www.naturalearthdata.com/">Natural Earth</a>',
  }).addTo(map);

  // Never let the player zoom out further than the whole world.
  const fitWorld = () => map.setMinZoom(map.getBoundsZoom(WORLD));
  fitWorld();
  map.fitBounds(WORLD);

  map.on('click', (event) => onPick(event.latlng));

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
        maxZoom: MAX_TILE_ZOOM,
      });
    },
    // Removes the markers and zooms back out to the whole world for the next round.
    reset() {
      layer.clearLayers();
      map.fitBounds(WORLD);
    },
  };
}
