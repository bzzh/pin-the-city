// Copies the game code the leaderboard server function needs into supabase/functions/_shared,
// keeping the same folder layout so their relative imports still work. Run before deploying:
//
//   npm run deploy:server
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const FILES = [
  'categories/categories.js',
  'game/daily.js',
  'game/scoring.js',
  'game/trio.js',
  'leaderboard/nickname.js',
  'leaderboard/verify.js',
];

const src = path.resolve('src');
const shared = path.resolve('supabase/functions/_shared');

await rm(shared, { recursive: true, force: true });
for (const file of FILES) {
  await mkdir(path.dirname(path.join(shared, file)), { recursive: true });
  await copyFile(path.join(src, file), path.join(shared, file));
}
console.log(`Copied ${FILES.length} files to supabase/functions/_shared`);
