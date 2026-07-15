import Phaser from 'phaser';
import { getAssetDefinition } from '@/assets/assetManager';
import { splitFormation } from './battleFormation';
import { loadSceneTexture } from './textureLoader';
import {
  COLOR_DAMAGE,
  COLOR_DEFENDED,
  COLOR_INCOMING_DAMAGE,
  COLOR_MISS,
  ensureParticleTexture,
  INCOMING_HIT_STAGGER_MS,
  PRE_ENEMY_ATTACK_DELAY_MS,
  playDefeatEffect,
  playFloatingText,
  playFxBurst,
  playIncomingCameraImpact,
  playIncomingLunge,
  playOutgoingHitOnSprite,
} from './battleEffects';

const PARTICLE_TEXTURE_KEY = 'fx-dot';
const DEFEAT_FX_ASSET_ID = 'fx.smoke-puff';
const DEFEAT_FX_FRAMES = [0, 1, 2, 3];
// Maps a playerAilments entry to the FX-pack sheet that visualizes it - only ailments with a real
// per-round "something is happening to you" effect get one (silence/stun already read clearly from
// their own UI banners, no burst needed).
const AILMENT_FX_ASSET: Record<string, string> = {
  poison: 'fx.poison-cloud',
  burn: 'fx.ember',
  freeze: 'fx.ice-shard',
};
const FRONT_ROW_Y_FRACTION = 0.72;
const BACK_ROW_Y_FRACTION = 0.42;
const BACK_ROW_SCALE = 0.8;
const BACK_ROW_ALPHA = 0.92;

export interface BattleEnemyVisual {
  index: number;
  spriteAssetId: string;
  name: string;
  tierLabel: string;
  tierColor: string;
  /** Drives createEnemySlot's baseSize branch (regular/elite/boss) - separate from tierLabel/
   *  tierColor, which are already-formatted display strings, not a machine-readable tier. */
  tier: 'regular' | 'elite' | 'boss';
  level: number;
  hp: number;
  maxHp: number;
  isBoss: boolean;
}

interface EnemySlot {
  sprite: Phaser.GameObjects.Sprite;
  hpTrackBg: Phaser.GameObjects.Rectangle;
  hpTrackFill: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  tierText: Phaser.GameObjects.Text;
  targetRing?: Phaser.GameObjects.Rectangle;
  hpTrackWidth: number;
  maxHp: number;
}

/** The battle-stage rendering Phaser Scene - background, enemy formation, HP bars, hit/defeat
 *  effects. Owns zero game logic (targeting rules, damage math, phase transitions) - purely
 *  imperative rendering, called by PhaserBattleCanvas.tsx in response to CombatScene.tsx's state.
 *  A fresh instance per encounter (CombatScene mounts/unmounts per fight - see the migration plan's
 *  risk assessment for why this Scene doesn't need ExplorationScene's generation-counter guards
 *  the same way, though loadEncounter gets one anyway for defensive consistency). */
export class BattleScene extends Phaser.Scene {
  private background: Phaser.GameObjects.Image | null = null;
  private enemySlots = new Map<number, EnemySlot>();
  private onReady?: () => void;
  private onTargetEnemy?: (index: number) => void;
  private encounterGeneration = 0;

  constructor(onReady?: () => void, onTargetEnemy?: (index: number) => void) {
    super({ key: 'BattleScene' });
    this.onReady = onReady;
    this.onTargetEnemy = onTargetEnemy;
  }

  create() {
    ensureParticleTexture(this, PARTICLE_TEXTURE_KEY);
    // Fire-and-forget: the defeat effect (playDefeat below) checks textures.exists before using
    // this, falling back to the dot texture on the (rare) chance a fight's first kill lands before
    // this finishes loading.
    loadSceneTexture(this, DEFEAT_FX_ASSET_ID).catch(() => {});
    this.onReady?.();
  }

  /** Loads the background + every enemy's sprite texture (parallel), builds the front/back
   *  formation, and creates one sprite + HP bar + name/tier text per enemy, wired interactive
   *  (click-to-target). Fixed roster for the fight's lifetime. */
  async loadEncounter(backgroundAssetId: string, enemies: BattleEnemyVisual[]): Promise<void> {
    this.encounterGeneration++;
    const generation = this.encounterGeneration;

    await Promise.all([loadSceneTexture(this, backgroundAssetId), ...enemies.map((e) => loadSceneTexture(this, e.spriteAssetId))]);
    // Defensive, not fixing a currently-reachable bug (CombatScene only ever calls this once per
    // BattleScene instance's life under the current one-Game-per-encounter lifecycle) - see the
    // migration plan's risk assessment.
    if (generation !== this.encounterGeneration) return;

    this.clear();

    const { width, height } = this.scale;
    this.renderBackground(backgroundAssetId, width, height);

    const { front, back } = splitFormation(enemies);
    this.layoutRow(front, width, height * FRONT_ROW_Y_FRACTION, 1, 1);
    this.layoutRow(back, width, height * BACK_ROW_Y_FRACTION, BACK_ROW_SCALE, BACK_ROW_ALPHA);
  }

  private renderBackground(assetId: string, viewportW: number, viewportH: number): void {
    const def = getAssetDefinition(assetId);
    const imgW = def.dimensions?.width ?? viewportW;
    const imgH = def.dimensions?.height ?? viewportH;
    // CSS `background-size: cover; background-position: center` equivalent - Phaser has no
    // built-in "cover" mode, this is the formula.
    const coverScale = Math.max(viewportW / imgW, viewportH / imgH);
    this.background = this.add
      .image(viewportW / 2, viewportH / 2, assetId)
      .setScale(coverScale)
      .setDepth(-1);
  }

  private layoutRow(enemies: BattleEnemyVisual[], viewportW: number, y: number, scale: number, alpha: number): void {
    if (enemies.length === 0) return;
    const spacing = viewportW / (enemies.length + 1);
    enemies.forEach((enemy, i) => {
      const x = spacing * (i + 1);
      this.createEnemySlot(enemy, x, y, scale, alpha);
    });
  }

  private createEnemySlot(enemy: BattleEnemyVisual, x: number, y: number, scale: number, alpha: number): void {
    const def = getAssetDefinition(enemy.spriteAssetId);
    // Close-up battle-stage sizing convention (not the exploration-tile-grid-scaled sizes from the
    // 3/4-view scale spec's literal numbers, which govern walking sprites/field-encounter icons
    // instead - a full-screen battle close-up needs its own, larger scale).
    const baseSize = enemy.isBoss ? 256 : enemy.tier === 'elite' ? 192 : 128;
    const spriteScale = (baseSize / (def.dimensions?.width ?? baseSize)) * scale;

    const sprite = this.add
      .sprite(x, y, enemy.spriteAssetId)
      .setScale(spriteScale)
      .setAlpha(alpha)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => this.onTargetEnemy?.(enemy.index));

    const hpTrackWidth = Math.min(160, baseSize * 1.25) * scale;
    // HP bar sits directly under the sprite's own rendered bounds, matching CSS's ".enemyBar" which
    // was likewise anchored to each enemy's own sprite rather than a shared/fixed position.
    const barY = sprite.y + sprite.displayHeight / 2 + 14 * scale;

    const hpTrackBg = this.add
      .rectangle(x, barY, hpTrackWidth, 8 * scale, 0x000000, 0.5)
      .setStrokeStyle(1, 0x000000, 0.6)
      .setDepth(11);
    const hpTrackFill = this.add.rectangle(x - hpTrackWidth / 2, barY, hpTrackWidth, 8 * scale, 0xb34b3c).setOrigin(0, 0.5).setDepth(12);

    const nameText = this.add
      .text(x, barY + 10 * scale, enemy.name, { fontSize: `${12 * scale}px`, color: '#ece1cf' })
      .setOrigin(0.5, 0)
      .setDepth(11)
      .setShadow(0, 1, 'rgba(0,0,0,0.8)', 4);
    const tierLabel = `${enemy.tierLabel}${enemy.isBoss ? '' : ` · Lv.${enemy.level}`}`;
    const tierText = this.add
      .text(x, barY + 24 * scale, tierLabel, { fontSize: `${10 * scale}px`, color: enemy.tierColor, fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setDepth(11)
      .setShadow(0, 1, 'rgba(0,0,0,0.9)', 3);

    this.enemySlots.set(enemy.index, {
      sprite,
      hpTrackBg,
      hpTrackFill,
      nameText,
      tierText,
      hpTrackWidth,
      maxHp: enemy.maxHp,
    });
    this.updateHpBar(enemy.index, enemy.hp);
  }

  private updateHpBar(index: number, hp: number): void {
    const slot = this.enemySlots.get(index);
    if (!slot) return;
    const pct = slot.maxHp > 0 ? Math.max(0, Math.min(1, hp / slot.maxHp)) : 0;
    this.tweens.add({
      targets: slot.hpTrackFill,
      width: slot.hpTrackWidth * pct,
      duration: 300,
      ease: 'Sine.easeOut',
    });
  }

  /** HP-only sync for an already-loaded roster: tweens each changed enemy's HP-bar fill. Does not
   *  remove dead enemies - playDefeat (chained from playOutgoingHits) owns that. */
  syncEnemies(enemies: BattleEnemyVisual[]): void {
    for (const enemy of enemies) {
      if (this.enemySlots.has(enemy.index)) this.updateHpBar(enemy.index, enemy.hp);
    }
  }

  /** Target-ring/marker visuals + each sprite's interactive state, ported verbatim from
   *  CombatScene's old `disabled={targetMode !== 'all' && !canPickTarget && enemy.index !==
   *  targetIndex}`. */
  setTargeting(targetIndex: number | null, targetMode: 'single' | 'all', canPickTarget: boolean): void {
    for (const [index, slot] of this.enemySlots) {
      const isTarget = targetMode === 'all' || index === targetIndex;
      const disabled = targetMode !== 'all' && !canPickTarget && index !== targetIndex;

      if (isTarget && !slot.targetRing) {
        const w = slot.sprite.displayWidth + 12;
        const h = slot.sprite.displayHeight + 12;
        slot.targetRing = this.add
          .rectangle(slot.sprite.x, slot.sprite.y, w, h, 0xe0a94a, 0.12)
          .setStrokeStyle(2, 0xe0a94a)
          .setDepth(9);
      } else if (!isTarget && slot.targetRing) {
        slot.targetRing.destroy();
        slot.targetRing = undefined;
      }

      if (disabled) slot.sprite.disableInteractive();
      else slot.sprite.setInteractive({ useHandCursor: true });
    }
  }

  /** Player's outgoing hits this round. Tint-flash + recoil-punch tween + floating "-N"/"MISS"
   *  text per hit. A defeated:true hit chains into playDefeat once the impact tween settles. */
  playOutgoingHits(hits: { targetIndex: number; damage: number; missed: boolean; defeated: boolean }[]): void {
    for (const hit of hits) {
      const slot = this.enemySlots.get(hit.targetIndex);
      if (!slot) continue;
      if (hit.missed) {
        playFloatingText(this, slot.sprite.x, slot.sprite.y - slot.sprite.displayHeight / 2 - 20, 'MISS', COLOR_MISS, true);
        continue;
      }
      playOutgoingHitOnSprite(this, slot.sprite);
      playFloatingText(this, slot.sprite.x, slot.sprite.y - slot.sprite.displayHeight / 2 - 20, `-${hit.damage}`, COLOR_DAMAGE);
      if (hit.defeated) {
        this.time.delayedCall(120, () => this.playDefeat(hit.targetIndex));
      }
    }
  }

  /** Enemy attacks landing on the player this round, staggered one attacker at a time (see
   *  INCOMING_HIT_STAGGER_MS) rather than all firing at once - in a multi-enemy fight, "everyone
   *  attacks simultaneously" made it impossible to tell who actually hit you. Per hit: a lunge
   *  tween on the attacking enemy's own sprite (identifies WHO attacked - the payoff of the
   *  structured per-attacker data), camera flash+shake scaled to severity, floating "-N" at a
   *  central arena anchor (no player sprite exists in the arena today) - large and centered rather
   *  than tucked near the bottom edge, so it reads as clearly as the outgoing damage numbers do
   *  against the enemies themselves. CombatScene.tsx reveals each hit's log line on this same
   *  stagger schedule (see INCOMING_HIT_STAGGER_MS's own comment for why that's two independently-
   *  scheduled timers rather than one shared clock). `fastRounds` (CombatScene's own per-encounter
   *  toggle) collapses the inter-enemy stagger to 0 so every hit lands together -
   *  PRE_ENEMY_ATTACK_DELAY_MS still applies either way. */
  playIncomingHits(
    hits: { attackerIndex: number; damage: number; missed: boolean; wasDefended: boolean }[],
    playerMaxHp: number,
    fastRounds: boolean,
  ): void {
    const { width, height } = this.scale;
    const anchorX = width / 2;
    const anchorY = height * 0.5;
    const INCOMING_TEXT_SIZE = 36;
    hits.forEach((hit, i) => {
      const stagger = fastRounds ? 0 : i * INCOMING_HIT_STAGGER_MS;
      this.time.delayedCall(PRE_ENEMY_ATTACK_DELAY_MS + stagger, () => {
        const slot = this.enemySlots.get(hit.attackerIndex);
        if (slot) playIncomingLunge(this, slot.sprite);
        if (hit.missed) {
          playFloatingText(this, anchorX, anchorY, 'MISS', COLOR_MISS, true, INCOMING_TEXT_SIZE);
          return;
        }
        const color = hit.wasDefended ? COLOR_DEFENDED : COLOR_INCOMING_DAMAGE;
        playFloatingText(this, anchorX, anchorY, `-${hit.damage}`, color, hit.wasDefended, INCOMING_TEXT_SIZE);
        playIncomingCameraImpact(this, hit.wasDefended ? hit.damage / 2 : hit.damage, playerMaxHp);
      });
    });
  }

  /** Fade+scale-down+particle-burst death sequence, then destroys that enemy's sprite/HP-bar/text. */
  private playDefeat(enemyIndex: number): void {
    const slot = this.enemySlots.get(enemyIndex);
    if (!slot) return;
    this.enemySlots.delete(enemyIndex);
    const useFxSmoke = this.textures.exists(DEFEAT_FX_ASSET_ID);
    playDefeatEffect(
      this,
      slot.sprite,
      useFxSmoke ? DEFEAT_FX_ASSET_ID : PARTICLE_TEXTURE_KEY,
      () => {
        slot.sprite.destroy();
        slot.hpTrackBg.destroy();
        slot.hpTrackFill.destroy();
        slot.nameText.destroy();
        slot.tierText.destroy();
        slot.targetRing?.destroy();
      },
      useFxSmoke ? DEFEAT_FX_FRAMES : undefined,
    );
  }

  /** Bursts the FX-pack sheet matching each of the player's currently-active ailments (poison/burn/
   *  freeze - see AILMENT_FX_ASSET) at a fixed bottom-of-arena anchor, same position
   *  playIncomingHits already uses for the player's own floating damage text. Called once per
   *  round (see PhaserBattleCanvas's ailmentFxEvent prop) so a lingering DoT ailment gets a fresh
   *  visual cue each round it's still ticking, not just on the round it was first inflicted. */
  async playAilmentEffects(ailmentIds: string[]): Promise<void> {
    const { width, height } = this.scale;
    const anchorX = width / 2;
    const anchorY = height * 0.92;
    for (const ailmentId of ailmentIds) {
      const assetId = AILMENT_FX_ASSET[ailmentId];
      if (!assetId) continue;
      await loadSceneTexture(this, assetId);
      playFxBurst(this, anchorX, anchorY, assetId);
    }
  }

  /** The dramatic, one-time "this ailment just landed" moment - several staggered bursts of the
   *  same FX-pack sheet playAilmentEffects uses, at random positions scattered across the whole
   *  arena (not the single fixed bottom anchor), so the instant an ailment first takes hold reads
   *  as a much bigger deal than the quieter per-round reapplication burst. Called once, the round
   *  an ailment is newly inflicted (see CombatScene.tsx's before/after playerAilments diff) -
   *  never for an ailment that was already active and is just continuing to tick. */
  async playAilmentTakesHold(ailmentIds: string[]): Promise<void> {
    const { width, height } = this.scale;
    const BURST_COUNT = 5;
    const BURST_STAGGER_MS = 130;
    for (const ailmentId of ailmentIds) {
      const assetId = AILMENT_FX_ASSET[ailmentId];
      if (!assetId) continue;
      await loadSceneTexture(this, assetId);
      for (let i = 0; i < BURST_COUNT; i++) {
        this.time.delayedCall(i * BURST_STAGGER_MS, () => {
          const x = width * (0.15 + Math.random() * 0.7);
          const y = height * (0.2 + Math.random() * 0.6);
          playFxBurst(this, x, y, assetId, 8);
        });
      }
    }
  }

  /** Stops every tween/emitter, destroys all visuals. Called on phase transition to
   *  victory/defeat/fled/error, and implicitly on unmount via Game.destroy(). */
  clear(): void {
    this.tweens.killAll();
    // Cancels any still-pending staggered playIncomingHits/playDefeat delayedCall - without this,
    // one queued up for a later attacker could fire after the fight has already ended and this
    // scene's enemy slots are gone, animating against nothing.
    this.time.removeAllEvents();
    this.background?.destroy();
    this.background = null;
    for (const slot of this.enemySlots.values()) {
      slot.sprite.destroy();
      slot.hpTrackBg.destroy();
      slot.hpTrackFill.destroy();
      slot.nameText.destroy();
      slot.tierText.destroy();
      slot.targetRing?.destroy();
    }
    this.enemySlots.clear();
  }

  /** Resizes the Phaser canvas to match the (ResizeObserver-driven) container size - same
   *  imperative-resize convention as ExplorationScene.setViewport, just triggered by an observer
   *  instead of a purpose-built sizing hook, since `.enemyArea` is a responsive flex region rather
   *  than a fixed pixel viewport. Known limitation: background cover-scale and enemy formation
   *  positions are only computed once, at loadEncounter time - they don't dynamically re-lay-out
   *  on a live resize (flagged as a manual-QA item in the migration plan, not solved here).
   *  PhaserBattleCanvas calls this straight from its ResizeObserver callback, unguarded by
   *  `sceneReady` (unlike every other imperative call) - the observer's own guaranteed initial
   *  notification can fire before Phaser's async scene boot has finished setting up `this.scale`,
   *  so this needs its own defensive check rather than relying on the caller to gate it. */
  setViewport(viewportSize: { width: number; height: number }): void {
    if (!this.scale) return;
    this.scale.resize(viewportSize.width, viewportSize.height);
  }
}
