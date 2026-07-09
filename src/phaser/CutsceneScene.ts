import Phaser from 'phaser';
import { getAssetDefinition, getAssetUrl } from '@/assets/assetManager';

/** The one reusable Phaser Scene behind every cutscene (intro, battle-start, defeat-recovery,
 *  quest-completion story beats) - owns just the full-screen background image and the dramatic
 *  camera flourishes (shake/flash). The actual text box is ordinary React+CSS, layered on top by
 *  Cutscene.tsx - same "Phaser owns the canvas, React owns the UI chrome" split already
 *  established for exploration/combat. */
export class CutsceneScene extends Phaser.Scene {
  private background: Phaser.GameObjects.Image | null = null;
  private onReady?: () => void;

  constructor(onReady?: () => void) {
    super({ key: 'CutsceneScene' });
    this.onReady = onReady;
  }

  create() {
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

  setViewport(viewportSize: { width: number; height: number }): void {
    if (!this.scale) return;
    this.scale.resize(viewportSize.width, viewportSize.height);
    if (this.background) {
      this.background.setPosition(viewportSize.width / 2, viewportSize.height / 2);
    }
  }

  clear(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.background?.destroy();
    this.background = null;
  }
}
