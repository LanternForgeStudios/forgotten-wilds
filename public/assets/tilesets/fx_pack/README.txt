ELEVERA FX PACK
================

Production-ready transparent PNG assets for Phaser.

Contents
--------
- sheets/: 4-frame horizontal sprite sheets (64x16)
- singles/: frame 0 as a standalone 16x16 PNG
- manifest.json: texture keys and dimensions
- phaser-example.ts: preload and particle examples

Sprite sheet frame size: 16x16
Frames per sheet: 4
Background: transparent RGBA
Scaling: use nearest-neighbor / pixelArt mode

Phaser load example:
this.load.spritesheet("fx-shadow-moth", "assets/fx/sheets/shadow_moth.png", {
  frameWidth: 16,
  frameHeight: 16
});

Particle example:
const emitter = this.add.particles(enemy.x, enemy.y, "fx-shadow-moth", {
  frame: [0, 1, 2, 3],
  anim: true,
  lifespan: 900,
  speed: { min: 30, max: 90 },
  alpha: { start: 1, end: 0 },
  scale: { start: 1, end: 0.25 },
  quantity: 1,
  emitting: false
});
emitter.explode(18);

Recommended Phaser config:
pixelArt: true,
antialias: false,
roundPixels: true
