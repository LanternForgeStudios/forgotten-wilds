import Phaser from 'phaser';

/** Colors matched to src/index.css's CSS variables, so the Phaser-driven effects read the same as
 *  the CSS ones they replace (--fw-danger, --fw-text-dim, --fw-accent). */
export const COLOR_DAMAGE = 0xc0392b; // --fw-danger
export const COLOR_INCOMING_DAMAGE = 0xe0a94a; // --fw-accent - distinct from outgoing damage's red,
// reads as "damage to you" vs. "damage you dealt" at a glance
export const COLOR_MISS = 0xb8a888; // --fw-text-dim
export const COLOR_DEFENDED = 0x7a94a8; // a cooler/dimmer blue-grey, for a successfully-defended hit
export const COLOR_WHITE = 0xffffff;

/** One-time 4x4 white square texture for the defeat particle burst - zero new art assets, per the
 *  migration plan. Call once from BattleScene.create(); safe to call again (no-ops if the texture
 *  already exists, e.g. across StrictMode's dev double-invoke). */
export function ensureParticleTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 4, 4);
  g.generateTexture(key, 4, 4);
  g.destroy();
}

/** Tint-flash + recoil-punch tween, for the player's own outgoing hit landing on an enemy -
 *  replaces .enemyBounce. Duration/ease chosen for a punchier, more legible "hit" read than the
 *  old vertical bounce. */
export function playOutgoingHitOnSprite(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite): void {
  // Phaser 4 split the old Phaser 3 setTintFill(color) into two calls: a tint color plus an
  // explicit fill tint mode (default mode is MULTIPLY, which would darken instead of flash white).
  sprite.setTint(COLOR_WHITE).setTintMode(Phaser.TintModes.FILL);
  scene.time.delayedCall(90, () => sprite.clearTint());
  const originX = sprite.x;
  scene.tweens.add({
    targets: sprite,
    x: originX - 10,
    duration: 110,
    ease: 'Back.easeOut',
    yoyo: true,
  });
}

/** Floating "-N" or "MISS" text, tweened upward and faded out - shared shape for outgoing damage,
 *  outgoing miss, and incoming damage (color/text differ per caller). Duration/ease reused 1:1
 *  from the old CSS floatUp keyframe (1.4s, ease-out) so the feel is unchanged even though the
 *  mechanism moved from a CSS animation to a Phaser tween. */
export function playFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number,
  italic = false,
): void {
  const label = scene.add
    .text(x, y, text, {
      fontSize: '18px',
      fontStyle: italic ? 'italic bold' : 'bold',
      color: `#${color.toString(16).padStart(6, '0')}`,
    })
    .setOrigin(0.5, 1)
    .setDepth(2000)
    .setShadow(0, 2, 'rgba(0,0,0,0.8)', 4);
  scene.tweens.add({
    targets: label,
    y: y - 48,
    alpha: { from: 1, to: 0 },
    duration: 1400,
    ease: 'Cubic.easeOut',
    onComplete: () => label.destroy(),
  });
}

/** A short "lunge" tween on the attacking enemy's own sprite - identifies WHICH enemy just hit the
 *  player, the concrete payoff of the new per-attacker enemyHits data (previously only an
 *  aggregate "you took N damage" toast existed). */
export function playIncomingLunge(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite): void {
  const originScale = sprite.scaleX;
  scene.tweens.add({
    targets: sprite,
    scaleX: originScale * 1.1,
    scaleY: originScale * 1.1,
    duration: 200,
    ease: 'Sine.easeInOut',
    yoyo: true,
  });
}

/** Camera shake+flash on an incoming hit, scaled to severity - the one effect CSS genuinely
 *  couldn't do cleanly (shaking the whole DOM tree would visibly jitter the HUD/log/action panel
 *  along with the battle stage; camera.shake() only perturbs the Phaser canvas's own contents). */
export function playIncomingCameraImpact(scene: Phaser.Scene, damage: number, playerMaxHp: number): void {
  const severity = playerMaxHp > 0 ? Math.min(1, damage / playerMaxHp) : 0;
  const intensity = 0.002 + severity * 0.02;
  scene.cameras.main.shake(180, intensity);
  if (severity > 0.03) {
    scene.cameras.main.flash(120, 180, 40, 40);
  }
}

/** Fade+scale-down tween paired with a one-shot particle burst - the defeat sequence, replacing
 *  the old "stays rendered until a 1500ms timeout expires" trick. `onComplete` is where the caller
 *  should actually destroy the enemy's sprite/HP-bar/text - this function only animates. */
export function playDefeatEffect(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  particleTextureKey: string,
  onComplete: () => void,
): void {
  const emitter = scene.add.particles(sprite.x, sprite.y, particleTextureKey, {
    tint: [0x888888, 0xa8762c],
    speed: { min: 60, max: 140 },
    lifespan: 400,
    scale: { start: 1, end: 0 },
    quantity: 12,
    emitting: false,
  });
  emitter.explode(12);
  scene.time.delayedCall(500, () => emitter.destroy());

  scene.tweens.add({
    targets: sprite,
    alpha: 0,
    scaleX: sprite.scaleX * 0.5,
    scaleY: sprite.scaleY * 0.5,
    duration: 500,
    ease: 'Cubic.easeIn',
    onComplete,
  });
}
