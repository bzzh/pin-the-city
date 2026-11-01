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

  return {
    showGuess(guess) {
      layer.clearLayers();
      L.circleMarker(guess, { radius: 7, color: css.getPropertyValue('--guess').trim() }).addTo(layer);
    },
    showAnswer(guess, answer) {
      const answerColor = css.getPropertyValue('--answer').trim();
      L.polyline([guess, answer], { color: answerColor, dashArray: '6 6', weight: 2 }).addTo(layer);
      L.circleMarker(answer, { radius: 7, color: answerColor }).addTo(layer);
      // Extra bottom padding keeps both markers clear of the result card.
      map.fitBounds(L.latLngBounds([guess, answer]), {
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
