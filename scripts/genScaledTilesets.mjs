// Generates a real, pre-scaled 16x16-grid copy of every tileset whose native tile size differs
// from the standard map grid (see docs on ExplorationScene.ts's runtime pre-scaling fallback,
// which this script is meant to make mostly unnecessary for authored maps going forward -
// swapping to these -16 tileset assets in Tiled means no runtime canvas work at all).
//
// Run with: node scripts/genScaledTilesets.mjs
//
// Spins up its own static file server (rather than depending on `npm run dev` already running)
// so this is safe to rerun standalone any time a source tileset image changes.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TILESETS_DIR = path.resolve(__dirname, '../public/assets/tilesets');
const TARGET_TILE = 16;

// Every currently-known tileset whose native tile size isn't already 16x16 - add a new entry here
// (and rerun) if a future tileset needs the same treatment.
const TILESETS = [
  { src: 'ground-tiles.png', nativeTile: 32 },
  { src: 'trees-signs-rocks-bridge.png', nativeTile: 32 },
  { src: 'Graveyard_Set.png', nativeTile: 48 },
  { src: 'water_animation_demo.png', nativeTile: 64 },
  { src: 'VelmoraRealms-Environments_Free.png', nativeTile: 32 },
];

function startStaticServer(dir) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const filePath = path.join(dir, decodeURIComponent(req.url ?? ''));
        const data = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const server = await startStaticServer(TILESETS_DIR);
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
// Navigate to the same origin first - loading images into a blank about:blank page taints the
// canvas as cross-origin (no origin at all), blocking toDataURL() even for a same-host image.
await page.goto(`http://127.0.0.1:${port}/`).catch(() => {});

for (const t of TILESETS) {
  const scale = TARGET_TILE / t.nativeTile;
  const dataUrl = await page.evaluate(
    async ({ url, scale }) => {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    },
    { url: `http://127.0.0.1:${port}/${t.src}`, scale },
  );
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const outName = t.src.replace(/\.png$/, '-16.png');
  fs.writeFileSync(path.join(TILESETS_DIR, outName), Buffer.from(base64, 'base64'));
  console.log('wrote', outName);
}

await browser.close();
server.close();
console.log('done');
