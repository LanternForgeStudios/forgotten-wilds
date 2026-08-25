// Offline Tiled map -> PNG compositor, so map edits can be self-reviewed (and shown to the user)
// without Tiled's own canvas. Reads a map JSON, composites every tile layer in order using each
// tileset's embedded image, masking Tiled's flip/rotate flag bits the same way
// src/phaser/ExplorationScene.ts and src/components/MiniMap.tsx do, and writes a PNG.
//
// Usage: node scripts/render-map-preview.mjs <map.json> <out.png> [--grid] [--collisions]
import { Jimp } from 'jimp';
import fs from 'node:fs';
import path from 'node:path';

const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;
const FLAG_MASK = FLIP_H | FLIP_V | FLIP_D;

const [, , mapArg, outArg, ...flags] = process.argv;
if (!mapArg || !outArg) {
  console.error('usage: node scripts/render-map-preview.mjs <map.json> <out.png> [--grid] [--collisions]');
  process.exit(1);
}
const showGrid = flags.includes('--grid');
const showCollisions = flags.includes('--collisions');

const mapDir = path.dirname(mapArg);
const data = JSON.parse(fs.readFileSync(mapArg, 'utf8'));
const { width, height, tilewidth, tileheight } = data;

const tilesetImages = await Promise.all(
  data.tilesets.map(async (ts) => {
    const imgPath = path.resolve(mapDir, ts.image.replace(/\\\//g, '/'));
    const img = await Jimp.read(imgPath);
    return { ts, img };
  }),
);

function tilesetFor(gid) {
  let match = null;
  for (const entry of tilesetImages) {
    if (gid >= entry.ts.firstgid) match = entry;
  }
  return match;
}

const out = new Jimp({ width: width * tilewidth, height: height * tileheight, color: 0x00000000 });

for (const layer of data.layers) {
  if (layer.type !== 'tilelayer' || !layer.visible) continue;
  const opacity = layer.opacity ?? 1;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const raw = layer.data[row * width + col];
      if (!raw) continue;
      const gid = raw & ~FLAG_MASK;
      const entry = tilesetFor(gid);
      if (!entry) continue;
      const local = gid - entry.ts.firstgid;
      const srcX = (local % entry.ts.columns) * tilewidth;
      const srcY = Math.floor(local / entry.ts.columns) * tileheight;
      if (opacity < 1) {
        const tile = entry.img.clone().crop({ x: srcX, y: srcY, w: tilewidth, h: tileheight });
        tile.opacity(opacity);
        out.composite(tile, col * tilewidth, row * tileheight);
      } else {
        out.blit({
          src: entry.img,
          x: col * tilewidth,
          y: row * tileheight,
          srcX,
          srcY,
          srcW: tilewidth,
          srcH: tileheight,
        });
      }
    }
  }
}

// Objects: small colored markers so spawn/transition/npc/interactable placement is reviewable too.
const objLayer = data.layers.find((l) => l.name === 'objects');
const OBJECT_COLORS = {
  spawnPoint: 0x00ff00ff,
  transition: 0xff9900ff,
  npc: 0x3399ffff,
  interactable: 0xffff00ff,
  zone: 0xff00ffaa,
};
if (objLayer) {
  for (const o of objLayer.objects) {
    const color = OBJECT_COLORS[o.type] ?? 0xffffffff;
    if (o.type === 'zone' && o.width && o.height) {
      for (let x = o.x; x < o.x + o.width; x++) {
        out.setPixelColor(color, x, o.y);
        out.setPixelColor(color, x, o.y + o.height - 1);
      }
      for (let y = o.y; y < o.y + o.height; y++) {
        out.setPixelColor(color, o.x, y);
        out.setPixelColor(color, o.x + o.width - 1, y);
      }
      continue;
    }
    const cx = o.x + tilewidth / 2;
    const cy = o.y + tileheight / 2;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy <= 9) out.setPixelColor(color, Math.round(cx + dx), Math.round(cy + dy));
      }
    }
  }
}

if (showCollisions) {
  const collLayer = data.layers.find((l) => l.name === 'collisions');
  if (collLayer) {
    for (const o of collLayer.objects) {
      for (let x = o.x; x < o.x + o.width; x++) {
        out.setPixelColor(0xff0000aa, x, o.y);
        out.setPixelColor(0xff0000aa, x, o.y + o.height - 1);
      }
      for (let y = o.y; y < o.y + o.height; y++) {
        out.setPixelColor(0xff0000aa, o.x, y);
        out.setPixelColor(0xff0000aa, o.x + o.width - 1, y);
      }
    }
  }
}

if (showGrid) {
  for (let col = 0; col <= width; col++) {
    for (let y = 0; y < height * tileheight; y++) out.setPixelColor(0x00000033, col * tilewidth, y);
  }
  for (let row = 0; row <= height; row++) {
    for (let x = 0; x < width * tilewidth; x++) out.setPixelColor(0x00000033, x, row * tileheight);
  }
}

await out.write(outArg);
console.log(`wrote ${outArg} (${width * tilewidth}x${height * tileheight})`);
