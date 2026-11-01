// Slices the Natural Earth II raster into map tiles for Leaflet's EPSG:4326 (flat lat/long) grid.
//
// 1. Download NE2_HR_LC_SR_W_DR.zip from https://www.naturalearthdata.com/downloads/10m-raster-data/
// 2. Unzip it, then run:  node scripts/build-tiles.js path/to/NE2_HR_LC_SR_W_DR.tif
//
// Writes public/tiles/{z}/{x}/{y}.webp. At zoom z the world is 512·2^z by 256·2^z pixels,
// i.e. 2^(z+1) tiles across and 2^z tiles down.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const TILE_SIZE = 256;
const MAX_ZOOM = 5; // 16,384 px wide, close to the source's 21,600 px; keep in sync with mapView.js
const BATCH = 32;

const [source, outDir = 'public/tiles'] = process.argv.slice(2);
if (!source) {
  console.error('Usage: node scripts/build-tiles.js <NE2 .tif file> [output dir]');
  process.exit(1);
}

for (let z = 0; z <= MAX_ZOOM; z++) {
  const columns = 2 ** (z + 1);
  const rows = 2 ** z;
  const width = columns * TILE_SIZE;
  const height = rows * TILE_SIZE;

  const { data, info } = await sharp(source, { limitInputPixels: false })
    .resize(width, height, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const jobs = [];
  for (let x = 0; x < columns; x++) {
    await mkdir(path.join(outDir, String(z), String(x)), { recursive: true });
    for (let y = 0; y < rows; y++) {
      jobs.push({ x, y });
    }
  }

  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(
      jobs.slice(i, i + BATCH).map(({ x, y }) =>
        sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
          .extract({ left: x * TILE_SIZE, top: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE })
          .webp({ quality: 75 })
          .toFile(path.join(outDir, String(z), String(x), `${y}.webp`)),
      ),
    );
  }
  console.log(`zoom ${z}: ${jobs.length} tiles`);
}
