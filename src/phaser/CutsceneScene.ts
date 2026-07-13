import Phaser from 'phaser';
import { getAssetDefinition, getAssetUrl } from '@/assets/assetManager';
import { ensureParticleTexture } from './battleEffects';

const PARTICLE_TEXTURE_KEY = 'fx-dot';
/** Sums to ~5s total, matching the defeat cutscene's "waking up" spec - named so the split is easy
 *  to retune after actually seeing it run (see playWakeUpSequence). */
const WAKE_BLACK_HOLD_MS = 1000;
const WAKE_TO_WHITE_MS = 1500;
const WAKE_TO_IMAGE_MS = 2500;
/** Per-enemy "pop into existence" beat, staggered so a multi-enemy group reads as a sequence of
 *  individual emergences rather than one flat event (see showEnemyArrivals). */
const ARRIVAL_STAGGER_MS = 140;
const ARRIVAL_POP_MS = 350;

/** The one reusable Phaser Scene behind every cutscene (intro, battle-start, defeat-recovery,
 *  quest-completion story beats) - owns just the full-screen background image and the dramatic
 *  camera flourishes (shake/flash). The actual text box is ordinary React+CSS, layered on top by
 *  Cutscene.tsx - same "Phaser owns the canvas, React owns the UI chrome" split already
 *  established for exploration/combat. */
export class CutsceneScene extends Phaser.Scene {
  private background: Phaser.GameObjects.Image | null = null;
  private wakeBlackRect: Phaser.GameObjects.Rectangle | null = null;
  private wakeWhiteRect: Phaser.GameObjects.Rectangle | null = null;
  private arrivalSprites: Phaser.GameObjects.Sprite[] = [];
  private onReady?: () => void;

  constructor(onReady?: () => void) {
    super({ key: 'CutsceneScene' });
    this.onReady = onReady;
  }

  create() {
    ensureParticleTexture(this, PARTICLE_TEXTURE_KEY);
    this.onReady?.();
  }

  private loadTexture(assetId: string): Promise<void> {
    if (this.textures.exists(assetId)) return Promise.resolve();
    const url = getAssetUrl(assetId);
    return new Promise((resolve) => {
      this.load.image(assetId, url);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  /** Loads and displays a full-screen "cover"-scaled background - same cover-scale formula as
   *  BattleScene.renderBackground, since a cutscene background follows the exact same "fill the
   *  screen, crop to fit" rule battle backgrounds already do. */
  async loadBackground(assetId: string, viewportW: number, viewportH: number): Promise<void> {
    await this.loadTexture(assetId);
    this.background?.destroy();
    const def = getAssetDefinition(assetId);
    const imgW = def.dimensions?.width ?? viewportW;
    const imgH = def.dimensions?.height ?? viewportH;
    const coverScale = Math.max(viewportW / imgW, viewportH / imgH);
    this.background = this.add.image(viewportW / 2, viewportH / 2, assetId).setScale(coverScale).setDepth(-1);
    this.background.setAlpha(0);
    this.tweens.add({ targets: this.background, alpha: 1, duration: 500, ease: 'Sine.easeIn' });
  }

  /** The "dramatic" flourish for a boss/high-stakes cutscene - a harder camera shake and a darker,
   *  slower flash than combat's own hit-impact flash (playIncomingCameraImpact), read as "this one
   *  matters more" rather than "you got hit." */
  playDramaticFlourish(): void {
    this.cameras.main.shake(400, 0.012);
    this.cameras.main.flash(500, 15, 10, 8);
  }

  /** Defeat cutscene's "waking up" entry, replacing loadBackground's plain fade-in for this one
   *  case: a held black screen, cross-fading to white (as if slowly opening your eyes), then the
   *  real background image fades into focus underneath as the white clears. ~5s total, split
   *  across three named constants for easy retuning. Two stacked rectangles (black held opaque,
   *  white cross-fading over it) rather than a numeric color-lerp, matching this codebase's
   *  existing alpha-tween idiom (see loadBackground's own tween) instead of a new technique. */
  async playWakeUpSequence(assetId: string, viewportW: number, viewportH: number): Promise<void> {
    const loadPromise = this.loadTexture(assetId);

    this.wakeBlackRect?.destroy();
    this.wakeWhiteRect?.destroy();
    this.wakeBlackRect = this.add.rectangle(viewportW / 2, viewportH / 2, viewportW, viewportH, 0x000000).setDepth(50);
    this.wakeWhiteRect = this.add
      .rectangle(viewportW / 2, viewportH / 2, viewportW, viewportH, 0xffffff)
      .setDepth(51)
      .setAlpha(0);

    await loadPromise;
    this.background?.destroy();
    const def = getAssetDefinition(assetId);
    const imgW = def.dimensions?.width ?? viewportW;
    const imgH = def.dimensions?.height ?? viewportH;
    const coverScale = Math.max(viewportW / imgW, viewportH / imgH);
    this.background = this.add
      .image(viewportW / 2, viewportH / 2, assetId)
      .setScale(coverScale)
      .setDepth(-1)
      .setAlpha(0);

    await new Promise<void>((resolve) => {
      this.time.delayedCall(WAKE_BLACK_HOLD_MS, () => {
        this.tweens.add({
          targets: this.wakeWhiteRect,
          alpha: 1,
          duration: WAKE_TO_WHITE_MS,
          ease: 'Sine.easeInOut',
          onComplete: () => resolve(),
        });
      });
    });

    await new Promise<void>((resolve) => {
      this.tweens.add({ targets: this.background, alpha: 1, duration: WAKE_TO_IMAGE_MS, ease: 'Sine.easeOut' });
      this.tweens.add({
        targets: this.wakeWhiteRect,
        alpha: 0,
        duration: WAKE_TO_IMAGE_MS,
        ease: 'Sine.easeOut',
        onComplete: () => resolve(),
      });
    });
    this.wakeBlackRect?.destroy();
    this.wakeBlackRect = null;
    this.wakeWhiteRect?.destroy();
    this.wakeWhiteRect = null;
  }

  /** Battle-entry cutscene flourish: each enemy about to be faced pops into view via a localized
   *  particle burst followed by a scale/alpha "emerge" tween, staggered so a multi-enemy group
   *  reads as a sequence of individual portal-emergences. A single simple row (not the real
   *  front/back battle formation) - this is a brief flourish, not positional parity with the fight. */
  async showEnemyArrivals(enemies: { spriteAssetId: string }[]): Promise<void> {
    if (enemies.length === 0) return;
    await Promise.all(enemies.map((e) => this.loadTexture(e.spriteAssetId)));

    for (const sprite of this.arrivalSprites) sprite.destroy();
    this.arrivalSprites = [];

    const { width, height } = this.scale;
    const y = height * 0.55;
    const spacing = width / (enemies.length + 1);

    enemies.forEach((enemy, i) => {
      const x = spacing * (i + 1);
      this.time.delayedCall(i * ARRIVAL_STAGGER_MS, () => {
        const emitter = this.add.particles(x, y, PARTICLE_TEXTURE_KEY, {
          tint: [0xffe9a8, 0xffffff],
          speed: { min: 60, max: 160 },
          lifespan: 350,
          scale: { start: 1.2, end: 0 },
          quantity: 14,
          emitting: false,
        });
        emitter.setDepth(9);
        emitter.explode(14);
        this.time.delayedCall(400, () => emitter.destroy());

        const def = getAssetDefinition(enemy.spriteAssetId);
        const targetScale = 96 / (def.dimensions?.width ?? 96);
        const sprite = this.add
          .sprite(x, y, enemy.spriteAssetId)
          .setDepth(10)
          .setAlpha(0)
          .setScale(targetScale * 0.4);
        this.arrivalSprites.push(sprite);
        this.tweens.add({
          targets: sprite,
          alpha: 1,
          scale: targetScale,
          duration: ARRIVAL_POP_MS,
          ease: 'Back.easeOut',
        });
      });
    });
  }

  setViewport(viewportSize: { width: number; height: number }): void {
    if (!this.scale) return;
    this.scale.resize(viewportSize.width, viewportSize.height);
    if (this.background) {
      this.background.setPosition(viewportSize.width / 2, viewportSize.height / 2);
    }
    if (this.wakeBlackRect) {
      this.wakeBlackRect.setPosition(viewportSize.width / 2, viewportSize.height / 2);
      this.wakeBlackRect.setSize(viewportSize.width, viewportSize.height);
    }
    if (this.wakeWhiteRect) {
      this.wakeWhiteRect.setPosition(viewportSize.width / 2, viewportSize.height / 2);
      this.wakeWhiteRect.setSize(viewportSize.width, viewportSize.height);
    }
  }

  clear(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.background?.destroy();
    this.background = null;
    this.wakeBlackRect?.destroy();
    this.wakeBlackRect = null;
    this.wakeWhiteRect?.destroy();
    this.wakeWhiteRect = null;
    for (const sprite of this.arrivalSprites) sprite.destroy();
    this.arrivalSprites = [];
  }
}
