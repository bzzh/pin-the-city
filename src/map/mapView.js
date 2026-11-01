import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const WORLD = L.latLngBounds([-90, -180], [90, 180]);
// Deepest zoom the player may reach; at this level cities show as grey patches.
const MAX_ZOOM = 7;
// Zoom used to frame the answer after a placement.
const ANSWER_ZOOM = 5;

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
        maxZoom: ANSWER_ZOOM,
      });
    },
    // Removes the markers and zooms back out to the whole world for the next round.
    reset() {
      layer.clearLayers();
      map.fitBounds(WORLD);
    },
  };
}
