import Phaser from 'phaser';

/** Colors matched to src/index.css's CSS variables, so the Phaser-driven effects read the same as
 *  the CSS ones they replace (--fw-danger, --fw-text-dim, --fw-accent). */
export const COLOR_DAMAGE = 0xc0392b; // --fw-danger
export const COLOR_INCOMING_DAMAGE = 0xe0a94a; // --fw-accent - distinct from outgoing damage's red,
// reads as "damage to you" vs. "damage you dealt" at a glance
export const COLOR_MISS = 0xb8a888; // --fw-text-dim
export const COLOR_DEFENDED = 0x7a94a8; // a cooler/dimmer blue-grey, for a successfully-defended hit
export const COLOR_WHITE = 0xffffff;

/** Depth for every particle emitter this file drives (defeat burst, ailment/hit FX bursts) - a
 *  Phaser particle emitter with no explicit depth defaults below BattleScene's enemy sprites
 *  (depth 10) and their HP-bar/name chrome (11-12), so it would render *behind* the thing it's
 *  supposed to be bursting on top of. Stays under playFloatingText's 2000 (damage numbers must
 *  always stay readable on top of everything, FX included). One shared constant so
 *  playFxBurst/playDefeatEffect can't drift apart on this. */
export const FX_EMITTER_DEPTH = 15;

/** Delay between each attacking enemy's turn in a multi-enemy round's incoming-hit playback (both
 *  the visual animation in BattleScene.playIncomingHits and the matching log-line reveal in
 *  CombatScene.tsx use this same value, kept in one place so they can't drift apart) - long enough
 *  to actually see one enemy's animation resolve before the next one goes, short enough that a
 *  5-6 enemy fight doesn't feel sluggish. Skipped entirely when the player has "Fast Rounds"
 *  enabled (see CombatScene.tsx) - every enemy's hit fires at once instead of one at a time. */
export const INCOMING_HIT_STAGGER_MS = 1400;

/** One-time pause after the player's own action resolves, before the first enemy attack begins -
 *  applies regardless of Fast Rounds (that toggle only removes the *stagger between* multiple
 *  enemies, not this beat before the first one). Without it, an enemy's retaliation felt like it
 *  landed in the same instant as the player's own attack animation, with no room to read the
 *  player's hit before the enemy's starts. */
export const PRE_ENEMY_ATTACK_DELAY_MS = 500;

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

/** One-time diagonal white streak texture (tapered rectangle, wide in the middle, pointed at both
 *  ends) for the slash-strike effect a physical hit plays just before its blood-splatter burst -
 *  same "generated placeholder, no new art asset" approach as ensureParticleTexture above (see
 *  CREDITS.md's generated-placeholder convention). Drawn wide/long so a single scaled-down sprite
 *  reads clearly as a blade streak rather than a blob at typical battle-hit sizes. */
export function ensureSlashTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const width = 96;
  const height = 20;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.beginPath();
  g.moveTo(0, height / 2);
  g.lineTo(width * 0.35, 0);
  g.lineTo(width, height / 2);
  g.lineTo(width * 0.35, height);
  g.closePath();
  g.fillPath();
  g.generateTexture(key, width, height);
  g.destroy();
}

/** A single quick diagonal slash streak across `x, y` - the "weapon making contact" beat a
 *  physical hit plays a moment before its blood-splatter impact burst (see BattleScene.
 *  playOutgoingHits). One sprite, not a particle emitter (playFxBurst's scattered-chunks look is
 *  wrong for a single decisive stroke) - scales in from 0, holds barely long enough to read, then
 *  fades, with a randomized angle each time so repeated attacks don't look identical. */
export function playSlashEffect(scene: Phaser.Scene, x: number, y: number, textureKey: string): void {
  const angle = -35 + Math.random() * 20;
  const sprite = scene.add
    .image(x, y, textureKey)
    .setDepth(FX_EMITTER_DEPTH + 1)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAngle(angle)
    .setScale(0.4, 1.6)
    .setAlpha(0);
  scene.tweens.add({
    targets: sprite,
    alpha: { from: 0, to: 1 },
    scaleX: { from: 0.4, to: 1.8 },
    duration: 70,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: sprite,
        alpha: 0,
        duration: 140,
        delay: 40,
        ease: 'Cubic.easeIn',
        onComplete: () => sprite.destroy(),
      });
    },
  });
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
  fontSize = 18,
): void {
  const label = scene.add
    .text(x, y, text, {
      fontSize: `${fontSize}px`,
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

/** A forward-step-and-shake tween on the attacking enemy's own sprite - identifies WHICH enemy
 *  just hit the player, the concrete payoff of the per-attacker enemyHits data (previously only
 *  an aggregate "you took N damage" toast existed). "Forward" is toward the viewer/player - down
 *  the arena, since the front/back row formation (BattleScene.layoutRow) places enemies further
 *  from the camera the higher up the arena they sit - followed by a quick horizontal shake (the
 *  windup/impact beat) before stepping back to its formation position. */
export function playIncomingLunge(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite): void {
  const originX = sprite.x;
  const originY = sprite.y;
  const forwardY = originY + sprite.displayHeight * 0.16;
  const shakeAmplitude = Math.max(4, sprite.displayWidth * 0.05);
  const SHAKE_REPEATS = 3;

  scene.tweens.add({
    targets: sprite,
    y: forwardY,
    duration: 150,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: sprite,
        x: originX - shakeAmplitude,
        duration: 55,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: SHAKE_REPEATS,
        onComplete: () => {
          scene.tweens.add({
            targets: sprite,
            x: originX,
            y: originY,
            duration: 180,
            ease: 'Sine.easeIn',
          });
        },
      });
    },
  });
}

/** Derives a hit-FX burst's quantity/intensity from how big `damage` is relative to
 *  `referenceMaxHp` (the target's own max HP for an outgoing hit, the player's for an incoming
 *  one) - shared by playOutgoingHits/playIncomingHits so a heavier hit visibly bursts bigger, not
 *  just more of the same small particles. Both values have a floor well above playFxBurst's own
 *  defaults, not a floor of "nothing" - a weak hit should still read as a satisfying hit, only a
 *  strong one should read as bigger still (see this file's own quantity/intensity doc comments). */
export function fxIntensityFor(damage: number, referenceMaxHp: number): { quantity: number; intensity: number } {
  const severity = referenceMaxHp > 0 ? Math.max(0, Math.min(1, damage / referenceMaxHp)) : 0;
  return { quantity: Math.round(14 + severity * 10), intensity: 1 + severity * 0.5 };
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

/** Flash-white-a-few-times, then fade+scale-down+particle-burst - the defeat sequence, replacing
 *  the old "stays rendered until a 1500ms timeout expires" trick. The flash reuses the same
 *  setTintFill white-flash convention playOutgoingHitOnSprite already uses for a landed hit, so a
 *  defeat reads as a distinct, more emphatic beat rather than just the fade alone. `onComplete` is
 *  where the caller should actually destroy the enemy's sprite/HP-bar/text - this function only
 *  animates. `frames` is set when `particleTextureKey` is a real animated FX-pack sheet (e.g. the
 *  smoke-puff burst) rather than the generated 4x4 dot texture - Phaser needs explicit frame
 *  indices to cycle through a spritesheet's frames instead of always rendering frame 0. */
export function playDefeatEffect(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  particleTextureKey: string,
  onComplete: () => void,
  frames?: number[],
): void {
  const FLASH_COUNT = 3;
  const FLASH_ON_MS = 90;
  const FLASH_OFF_MS = 90;

  const fadeOut = () => {
    const emitter = scene.add.particles(sprite.x, sprite.y, particleTextureKey, {
      ...(frames ? { frame: frames } : { tint: [0x888888, 0xa8762c] }),
      speed: { min: 60, max: 140 },
      lifespan: 400,
      scale: { start: 1, end: 0 },
      quantity: 12,
      emitting: false,
    });
    emitter.setDepth(FX_EMITTER_DEPTH);
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
  };

  let flashesLeft = FLASH_COUNT;
  const flash = () => {
    if (flashesLeft <= 0) {
      sprite.clearTint();
      fadeOut();
      return;
    }
    flashesLeft--;
    sprite.setTint(COLOR_WHITE).setTintMode(Phaser.TintModes.FILL);
    scene.time.delayedCall(FLASH_ON_MS, () => {
      sprite.clearTint();
      scene.time.delayedCall(FLASH_OFF_MS, flash);
    });
  };
  flash();
}

/** One-shot animated particle burst from a 4-frame FX-pack sheet (16x16 frames, indices 0-3 - see
 *  public/assets/tilesets/fx_pack/manifest.json) at a fixed point - the shared shape behind every
 *  ailment-effect burst (poison/burn/freeze) and reusable for any future FX-pack wiring. Caller
 *  must have already loaded `textureKey` as a spritesheet (BattleScene.loadTexture handles this
 *  generically for any registry id with a frameSize). `intensity` (default 1, clamped >= 0.7 by
 *  every caller that derives it from hit severity - see severityFor) scales particle size/speed on
 *  top of `quantity` - a weak hit still reads as a real hit, a strong one reads as bigger, not just
 *  "more of the same small particles." */
export function playFxBurst(scene: Phaser.Scene, x: number, y: number, textureKey: string, quantity = 14, intensity = 1): void {
  const emitter = scene.add.particles(x, y, textureKey, {
    frame: [0, 1, 2, 3],
    lifespan: { min: 600, max: 1100 },
    speed: { min: 30 * intensity, max: 110 * intensity },
    angle: { min: 200, max: 340 },
    alpha: { start: 1, end: 0 },
    scale: { start: 2.1 * intensity, end: 0.5 * intensity },
    rotate: { min: -180, max: 180 },
    emitting: false,
  });
  emitter.setDepth(FX_EMITTER_DEPTH);
  emitter.explode(quantity);
  scene.time.delayedCall(1300, () => emitter.destroy());
}
