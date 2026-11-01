// Adds climate averages to public/data/cities.json from WorldClim 2.1 (1970–2000 averages).
//
// 1. Download wc2.1_5m_tavg.zip, wc2.1_5m_prec.zip and wc2.1_5m_elev.zip from
//    https://www.worldclim.org/data/worldclim21.html and unzip them into one folder.
// 2. Run:  node scripts/build-climate.js path/to/that/folder
//
// Run it again after build-cities.js, which rewrites cities.json without climate data.
// Each city gets avgTempC (yearly mean temperature) and rainMmYear (yearly rainfall).
// A grid cell is ~9 km across, so temperatures are corrected for the difference between the
// cell's average elevation and the city's own, using the usual 6.5 °C per km.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fromFile } from 'geotiff';

const OUT = new URL('../public/data/cities.json', import.meta.url);
const LAPSE_C_PER_M = 0.0065;
// Coastal cities can fall in a sea cell (no data); look this many cells around for land.
const SEARCH_CELLS = 3;
// Elevation corrections bigger than this are reported, in case a city's elevation is wrong.
const REPORT_CORRECTION_C = 2;

const [folder] = process.argv.slice(2);
if (!folder) {
  console.error('Usage: node scripts/build-climate.js <folder with the unzipped WorldClim .tif files>');
  process.exit(1);
}

// Finds the .tif files recursively, e.g. wc2.1_5m_tavg_01.tif.
async function findTifs(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith('.tif')).map((e) => path.join(e.parentPath, e.name));
}

// Loads a global grid: values row by row from the top-left corner (-180°, 90°).
async function loadGrid(file) {
  const image = await (await fromFile(file)).getImage();
  const [values] = await image.readRasters();
  const noData = image.getGDALNoData();
  return { values, width: image.getWidth(), height: image.getHeight(), noData };
}

// The value in the cell containing (lat, lng), or the nearest cell with data. null if none.
function sample(grid, lat, lng) {
  const { values, width, height, noData } = grid;
  const col = Math.min(width - 1, Math.floor(((lng + 180) / 360) * width));
  const row = Math.min(height - 1, Math.floor(((90 - lat) / 180) * height));
  const valid = (v) => Number.isFinite(v) && v !== noData && v > -1e30;
  for (let r = 0; r <= SEARCH_CELLS; r++) {
    let best = null;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // only the ring at distance r
        const y = row + dy;
        const x = (col + dx + width) % width;
        if (y < 0 || y >= height) continue;
        const value = values[y * width + x];
        const distance = dx * dx + dy * dy;
        if (valid(value) && (!best || distance < best.distance)) best = { value, distance };
      }
    }
    if (best) return best.value;
  }
  return null;
}

const tifs = await findTifs(folder);
const monthly = (variable) => tifs.filter((file) => path.basename(file).includes(`_${variable}_`)).sort();
const tempFiles = monthly('tavg');
const rainFiles = monthly('prec');
const elevFile = tifs.find((file) => path.basename(file).includes('_elev'));
if (tempFiles.length !== 12 || rainFiles.length !== 12 || !elevFile) {
  console.error('Expected 12 tavg files, 12 prec files and 1 elev file.');
  process.exit(1);
}

const cities = JSON.parse(await readFile(OUT, 'utf8'));
const temps = cities.map(() => []);
const rains = cities.map(() => []);

// One month at a time, so only a couple of grids are in memory at once.
for (let month = 0; month < 12; month++) {
  const [tempGrid, rainGrid] = await Promise.all([loadGrid(tempFiles[month]), loadGrid(rainFiles[month])]);
  cities.forEach((city, i) => {
    temps[i].push(sample(tempGrid, city.lat, city.lng));
    rains[i].push(sample(rainGrid, city.lat, city.lng));
  });
  console.log(`month ${month + 1}/12`);
}
const elevGrid = await loadGrid(elevFile);

const round1 = (value) => Math.round(value * 10) / 10;
const missing = [];
const corrected = [];
cities.forEach((city, i) => {
  delete city.avgTempC;
  delete city.rainMmYear;
  if (temps[i].includes(null) || rains[i].includes(null)) {
    missing.push(city.name);
    return;
  }
  let temp = temps[i].reduce((sum, v) => sum + v, 0) / 12;
  const cellElevation = sample(elevGrid, city.lat, city.lng);
  if (Number.isFinite(city.elevationM) && cellElevation !== null) {
    const correction = (cellElevation - city.elevationM) * LAPSE_C_PER_M;
    if (Math.abs(correction) >= REPORT_CORRECTION_C) {
      corrected.push(`${city.name}: ${correction > 0 ? '+' : ''}${correction.toFixed(1)} °C (cell ${Math.round(cellElevation)} m, city ${city.elevationM} m)`);
    }
    temp += correction;
  }
  city.avgTempC = round1(temp);
  city.rainMmYear = Math.round(rains[i].reduce((sum, v) => sum + v, 0));
});

await writeFile(OUT, `${JSON.stringify(cities, null, 1)}\n`);

console.log(`\n${cities.length - missing.length}/${cities.length} cities have climate data.`);
if (missing.length) console.log(`No data for: ${missing.join(', ')}`);
if (corrected.length) console.log(`\nLarge elevation corrections (check the city's elevation):\n  ${corrected.join('\n  ')}`);

const ranked = (key) => [...cities].filter((c) => c[key] !== undefined).sort((a, b) => a[key] - b[key]);
const show = (list, key, unit) => list.map((c) => `${c.name} ${c[key]}${unit}`).join(', ');
for (const [key, unit] of [['avgTempC', ' °C'], ['rainMmYear', ' mm']]) {
  const list = ranked(key);
  console.log(`\n${key}: lowest ${show(list.slice(0, 5), key, unit)}\n  highest ${show(list.slice(-5), key, unit)}`);
}
