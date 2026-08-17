import Phaser from 'phaser';
import { getAssetDefinition } from '@/assets/assetManager';
import { AILMENT_TINT_HEX } from '@/utils/ailmentTint';
import { animationLayoutForSprite } from '@/animation/characterAnimations';
import type { DamageType } from '@/types';
import { splitFormation } from './battleFormation';
import { loadSceneTexture } from './textureLoader';
import { createCharacterAnimations, animationKey } from './animationDefs';
import {
  COLOR_DAMAGE,
  COLOR_DEFENDED,
  COLOR_INCOMING_DAMAGE,
  COLOR_MISS,
  ensureParticleTexture,
  ensureSlashTexture,
  fxIntensityFor,
  INCOMING_HIT_STAGGER_MS,
  PRE_ENEMY_ATTACK_DELAY_MS,
  playDefeatEffect,
  playFloatingText,
  playFxBurst,
  playIncomingCameraImpact,
  playIncomingLunge,
  playOutgoingHitOnSprite,
  playSlashEffect,
} from './battleEffects';

const PARTICLE_TEXTURE_KEY = 'fx-dot';
const SLASH_TEXTURE_KEY = 'fx-slash';
const DEFEAT_FX_ASSET_ID = 'fx.smoke-puff';
const DEFEAT_FX_FRAMES = [0, 1, 2, 3];
// Maps a playerAilments entry to the FX-pack sheet that visualizes it - only ailments with a real
// per-round "something is happening to you" effect get one (silence/stun already read clearly from
// their own UI banners, no burst needed).
const AILMENT_FX_ASSET: Record<string, string> = {
  poison: 'fx.poison-cloud',
  burn: 'fx.ember',
  freeze: 'fx.ice-shard',
  // Was missing entirely (unlike stun/silence, which are deliberately excluded - see this
  // constant's own comment) - Blind never got a burst of its own, silently falling through the
  // `.filter((id): id is string => !!id)` below. fx.dark-energy was already a real, registered FX
  // pack asset, just never wired to anything - a natural fit for "your vision is obscured."
  blind: 'fx.dark-energy',
};
// Generic "something landed" impact FX, keyed by the attack's damage type - bursts on the target's
// own sprite for every landed (non-missed) outgoing hit (player -> enemy in solo/Endless Battle,
// or the acting player -> their opponent in PvP), across all three battle scenes alike, the same
// way AILMENT_FX_ASSET already does for a specifically-colored ailment burst. Skipped whenever a
// hit's own ailmentInflicted is set instead (see playOutgoingHits) - a landed Burn already gets
// its own distinctly-colored, bigger burst (playEnemyAilmentTakesHold), so this would just be
// visual clutter layered on top of that same hit.
const HIT_FX_ASSET: Record<DamageType, string> = {
  physical: 'fx.blood-splatter',
  lantern: 'fx.holy-light',
  spirit: 'fx.magic-spark',
};
// Impact FX for an INCOMING hit (enemy -> player), keyed by CombatScene.tsx's own
// ENEMY_FAMILY_HIT_GROUP (mirrors its ENEMY_HIT_SFX id-per-group, just the visual half) - bursts
// at playIncomingHits' own floating-text anchor, since no player sprite exists in the arena today.
const ENEMY_HIT_FX_ASSET: Record<'beast' | 'earthen' | 'spirit' | 'boss', string> = {
  beast: 'fx.blood-splatter',
  earthen: 'fx.bone-fragment',
  spirit: 'fx.dark-energy',
  boss: 'fx.bone-fragment',
};
// Anchors the enemy sprite's own center - the HP bar/name/tier-text stack renders *below* that
// (see createEnemySlot: barY = sprite bottom edge + ~14px, then name/tier further down still),
// so a low anchor combined with a tall sprite (a boss's displayHeight can be 2x a regular
// enemy's) pushed that whole stack close to or past the canvas's bottom edge on a shorter
// viewport - independent of the target-hint overlay, which just made the crowding worse.
// Previously 0.72/0.42; raised so the full stack comfortably clears the bottom on typical
// battle-canvas heights, not just tall ones.
const FRONT_ROW_Y_FRACTION = 0.52;
const BACK_ROW_Y_FRACTION = 0.28;
const BACK_ROW_SCALE = 0.8;
const BACK_ROW_ALPHA = 0.92;
// Enemy sprites read as too small once real (non-placeholder) art was in across the board - a
// bigger bump on desktop than mobile since a touch canvas has proportionally less room per enemy
// to begin with (createEnemySlot's own spacing*0.7 cap already guards against overflow on a
// narrow/multi-enemy canvas either way, so this multiplier is a target, not a guarantee).
const DESKTOP_SIZE_MULTIPLIER = 1.5;
const MOBILE_SIZE_MULTIPLIER = 1.25;

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
  /** Ailment ids (see data/ailments.ts) currently active on this enemy - see
   *  createEnemySlot/updateAilments for how this drives the sprite tint + badge text. Empty for an
   *  unafflicted enemy. */
  ailmentIds: string[];
}

interface EnemySlot {
  sprite: Phaser.GameObjects.Sprite;
  hpTrackBg: Phaser.GameObjects.Rectangle;
  hpTrackFill: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  tierText: Phaser.GameObjects.Text;
  ailmentText: Phaser.GameObjects.Text;
  targetRing?: Phaser.GameObjects.Rectangle;
  hpTrackWidth: number;
  maxHp: number;
  /** Last ailmentIds passed to updateAilments for this slot - lets syncEnemies (called once every
   *  round for every enemy) skip the setTint/setText work entirely when nothing actually changed,
   *  rather than redoing it unconditionally each round. */
  lastAilmentKey?: string;
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
  private isMobile: boolean;

  constructor(onReady?: () => void, onTargetEnemy?: (index: number) => void, isMobile = false) {
    super({ key: 'BattleScene' });
    this.onReady = onReady;
    this.onTargetEnemy = onTargetEnemy;
    this.isMobile = isMobile;
  }

  create() {
    ensureParticleTexture(this, PARTICLE_TEXTURE_KEY);
    ensureSlashTexture(this, SLASH_TEXTURE_KEY);
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
    this.layoutRow(front, width, height * FRONT_ROW_Y_FRACTION, 1, 1, false);
    // Staggered horizontally only when front is populated AND the back row isn't a boss - a boss
    // always stays dead-center in the back row (explicit requirement: "the boss should always be
    // in the back row and in the middle"), never nudged off-center to avoid stacking under a front
    // add. splitFormation only ever puts a boss in `back` alone (never mixed with non-boss
    // entries), so a single boss there is already exactly centered by the row-spacing formula with
    // no offset needed. A lone non-boss overflow enemy (a 4th-6th regular/elite in a big group,
    // not a boss fight) still gets no stagger either, for the same "nothing to stagger against"
    // reason a solo boss doesn't.
    const backHasBoss = back.some((e) => e.isBoss);
    this.layoutRow(back, width, height * BACK_ROW_Y_FRACTION, BACK_ROW_SCALE, BACK_ROW_ALPHA, front.length > 0 && !backHasBoss);
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

  private layoutRow(enemies: BattleEnemyVisual[], viewportW: number, y: number, scale: number, alpha: number, stagger: boolean): void {
    if (enemies.length === 0) return;
    const spacing = viewportW / (enemies.length + 1);
    // Staggers the row half a slot-width to the right so it doesn't land in a straight column
    // directly above/below the other row's sprites - front and back rows share the exact same
    // spacing formula, so with equal (or coincidentally-overlapping) counts they'd otherwise sit
    // at identical x positions, one straight on top of the other.
    const xOffset = stagger ? spacing / 2 : 0;
    enemies.forEach((enemy, i) => {
      const x = spacing * (i + 1) + xOffset;
      this.createEnemySlot(enemy, x, y, scale, alpha, spacing);
    });
  }

  private createEnemySlot(enemy: BattleEnemyVisual, x: number, y: number, scale: number, alpha: number, spacing: number): void {
    const def = getAssetDefinition(enemy.spriteAssetId);
    // Close-up battle-stage sizing convention (not the exploration-tile-grid-scaled sizes from the
    // 3/4-view scale spec's literal numbers, which govern walking sprites/field-encounter icons
    // instead - a full-screen battle close-up needs its own, larger scale). Originally halved from
    // 256/192/128 (full size overlapped a multi-enemy formation's sprites), then bumped up twice
    // once real art was in and still read as too small - first ~25% (64/96/128 -> 80/120/160), then
    // a further ~40% on top of that (a full-screen close-up view can carry noticeably bigger art
    // than the overworld field-encounter icons this size doesn't apply to - see enemyMapIcon.ts,
    // which stopped needing further bumps at the first pass). Further capped to a fraction of this
    // slot's own allocated spacing (viewportW / enemy count) rather than staying a fixed pixel
    // target - on a narrow mobile canvas, a fixed-size sprite ate up proportionally more of the
    // (already narrow) per-slot width than on desktop, so a multi-enemy formation still overlapped
    // there even after the desktop-tuned halving.
    const sizeMultiplier = this.isMobile ? MOBILE_SIZE_MULTIPLIER : DESKTOP_SIZE_MULTIPLIER;
    const baseSize = (enemy.isBoss ? 224 : enemy.tier === 'elite' ? 168 : 112) * sizeMultiplier;
    // 0.7, not a looser fraction like 0.85 - on a wide desktop canvas spacing is already generous
    // enough that this cap rarely engages at all (desktop scaling is untouched), but on a narrow
    // mobile canvas even a 3-regular-enemy row left barely any gap between sprites at a looser
    // factor, which is exactly the "still too large on mobile" report this exists to fix.
    const cappedSize = Math.min(baseSize, spacing * 0.7);
    // splitFormation always puts the boss in the "back" row (even when it's alone with zero adds -
    // see that file's own comment), which normally means the BACK_ROW_SCALE/BACK_ROW_ALPHA
    // depth-cue dampening (0.8x size, 92% alpha) applies - appropriate for genuine background-row
    // filler in a 4-6 enemy group, but backwards for a boss: baseSize already doubles its footprint
    // specifically so it reads as imposing, and stacking a further 0.8x shrink on top of that nearly
    // cancels the size difference against a front-row elite add (224*0.8=179 vs 168), which is
    // exactly the "boss doesn't look any bigger" report this fixes. The boss keeps its raised
    // back-row Y position (still looms behind/above its escort) but always renders at full
    // scale/opacity, never the row's dampened values.
    const effectiveScale = enemy.isBoss ? 1 : scale;
    const effectiveAlpha = enemy.isBoss ? 1 : alpha;
    // A frameSize'd (animated) enemy's `dimensions` is the *whole sheet*, not one frame - scaling
    // off that would render it roughly frameCount-times too small. Scale off frameSize instead so
    // an idle-animated enemy renders at the same on-screen size a plain static sprite would.
    const nativeWidth = def.frameSize?.width ?? def.dimensions?.width ?? cappedSize;
    const spriteScale = (cappedSize / nativeWidth) * effectiveScale;

    const sprite = this.add
      .sprite(x, y, enemy.spriteAssetId)
      .setScale(spriteScale)
      .setAlpha(effectiveAlpha)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => this.onTargetEnemy?.(enemy.index));

    // Ambient idle/fight-stance sway, mirroring ExplorationScene.ts's upsertEntity - most enemies
    // don't have one yet, in which case this is a no-op and the sprite just shows its single
    // static frame exactly as before (Phaser defaults to frame 0 with no animation playing).
    if (def.frameSize) {
      createCharacterAnimations(this.anims, enemy.spriteAssetId, animationLayoutForSprite(enemy.spriteAssetId));
      const idleKey = animationKey(enemy.spriteAssetId, 'idle', 'down');
      if (this.anims.exists(idleKey)) sprite.play(idleKey);
    }

    const hpTrackWidth = Math.min(160, cappedSize * 1.25) * effectiveScale;
    // HP bar sits directly under the sprite's own rendered bounds, matching CSS's ".enemyBar" which
    // was likewise anchored to each enemy's own sprite rather than a shared/fixed position.
    const barY = sprite.y + sprite.displayHeight / 2 + 14 * effectiveScale;

    const hpTrackBg = this.add
      .rectangle(x, barY, hpTrackWidth, 8 * effectiveScale, 0x000000, 0.5)
      .setStrokeStyle(1, 0x000000, 0.6)
      .setDepth(11);
    const hpTrackFill = this.add
      .rectangle(x - hpTrackWidth / 2, barY, hpTrackWidth, 8 * effectiveScale, 0xb34b3c)
      .setOrigin(0, 0.5)
      .setDepth(12);

    const nameText = this.add
      .text(x, barY + 10 * effectiveScale, enemy.name, { fontSize: `${12 * effectiveScale}px`, color: '#ece1cf' })
      .setOrigin(0.5, 0)
      .setDepth(11)
      .setShadow(0, 1, 'rgba(0,0,0,0.8)', 4);
    const tierLabel = `${enemy.tierLabel}${enemy.isBoss ? '' : ` · Lv.${enemy.level}`}`;
    const tierText = this.add
      .text(x, barY + 24 * effectiveScale, tierLabel, { fontSize: `${10 * effectiveScale}px`, color: enemy.tierColor, fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setDepth(11)
      .setShadow(0, 1, 'rgba(0,0,0,0.9)', 3);
    const ailmentText = this.add
      .text(x, barY + 38 * effectiveScale, '', { fontSize: `${10 * effectiveScale}px`, color: '#ffcf6b', fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setDepth(11)
      .setShadow(0, 1, 'rgba(0,0,0,0.9)', 3);

    this.enemySlots.set(enemy.index, {
      sprite,
      hpTrackBg,
      hpTrackFill,
      nameText,
      tierText,
      ailmentText,
      hpTrackWidth,
      maxHp: enemy.maxHp,
    });
    this.updateHpBar(enemy.index, enemy.hp);
    this.updateAilments(enemy.index, enemy.ailmentIds);
  }

  /** Tints the enemy's sprite to the first active ailment with a real color (see AILMENT_TINT_HEX -
   *  Stun/Blind have no tint, matching the screen-wash convention those two already skip for the
   *  player) and lists every active ailment's name in the badge text beneath its tier label. A
   *  pragmatic first pass, not a full multi-ailment blend - good enough to read "something is
   *  wrong with this enemy" at a glance, which is the goal. */
  private updateAilments(index: number, ailmentIds: string[]): void {
    const slot = this.enemySlots.get(index);
    if (!slot) return;
    const key = ailmentIds.join(',');
    if (slot.lastAilmentKey === key) return;
    slot.lastAilmentKey = key;
    const tintedId = ailmentIds.find((id) => AILMENT_TINT_HEX[id] !== undefined);
    if (tintedId) slot.sprite.setTint(AILMENT_TINT_HEX[tintedId]);
    else slot.sprite.clearTint();
    slot.ailmentText.setText(ailmentIds.map((id) => id.charAt(0).toUpperCase() + id.slice(1)).join(', '));
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

  /** Sync for an already-loaded roster: tweens each changed enemy's HP-bar fill and refreshes its
   *  ailment tint/badge text. Does not remove dead enemies - playDefeat (chained from
   *  playOutgoingHits) owns that. */
  syncEnemies(enemies: BattleEnemyVisual[]): void {
    for (const enemy of enemies) {
      if (!this.enemySlots.has(enemy.index)) continue;
      this.updateHpBar(enemy.index, enemy.hp);
      this.updateAilments(enemy.index, enemy.ailmentIds);
    }
  }

  /** Target-ring/marker visuals + each sprite's interactive state, ported verbatim from
   *  CombatScene's old `disabled={targetMode !== 'all' && !canPickTarget && enemy.index !==
   *  targetIndex}`.
   *
   *  `inputSuspended` (2026-08) unconditionally forces every sprite non-interactive, bypassing
   *  the target/canPickTarget formula above entirely - that formula always leaves the CURRENTLY
   *  targeted sprite clickable regardless of canPickTarget, which is fine during normal play but
   *  is exactly the gap that let a React overlay rendered on top of the canvas (the Spirit
   *  Specialty select menu, the item-use modal, the ailment detail popup) silently re-target
   *  through itself: Phaser's own input system does its own hit-testing against sprite bounds
   *  using raw pointer coordinates, blind to whatever DOM element a browser click was actually
   *  delivered to, so a still-interactive sprite underneath a full-screen modal fires its own
   *  pointerdown/onTargetEnemy the instant a click lands anywhere over it - including a click on
   *  a button in the modal that just happens to be positioned above that sprite. The caller
   *  passes true whenever any such modal is open. */
  setTargeting(targetIndex: number | null, targetMode: 'single' | 'all', canPickTarget: boolean, inputSuspended: boolean): void {
    for (const [index, slot] of this.enemySlots) {
      const isTarget = targetMode === 'all' || index === targetIndex;
      const disabled = inputSuspended || (targetMode !== 'all' && !canPickTarget && index !== targetIndex);

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
   *  text per hit, plus a slash-streak precursor (see SLASH_TEXTURE_KEY, a procedurally generated
   *  texture - no new art asset, same convention as PARTICLE_TEXTURE_KEY) for a physical hit only -
   *  a spirit/lantern hit's own impact FX already reads as the "weapon contact" beat on its own.
   *  Also bursts an impact FX on the target's own sprite for every landed hit: `themedAilmentId`
   *  (set by the caller whenever the acting skill has its own elemental identity - e.g. Marsh Toxin
   *  is always poison-themed, whether or not the poison roll actually lands this turn - see
   *  CombatScene.tsx's own themedAilmentId comment) wins when present, so a themed skill always
   *  shows its own colored FX (poison-cloud/ember/ice-shard/dark-energy) instead of the generic
   *  damageType one; `ailmentInflicted` (the ailment actually landing THIS hit) wins over that if
   *  different, so an untelegraphed ailment proc still gets its own correct color. Both cases still
   *  layer under playEnemyAilmentTakesHold's own bigger burst the round an ailment is newly
   *  inflicted - intentional escalation, not double-counting: routine landed hits get the themed
   *  color, an actual proc gets that same color twice in quick succession. Falls back to the
   *  generic HIT_FX_ASSET (blood/holy-light/magic-spark, keyed by damageType) for anything with no
   *  elemental identity at all (a plain attack, or a spirit skill with no ailment tie). */
  playOutgoingHits(
    hits: {
      targetIndex: number;
      damage: number;
      missed: boolean;
      defeated: boolean;
      damageType: DamageType;
      ailmentInflicted?: string;
      themedAilmentId?: string;
      targetMaxHp: number;
    }[],
  ): void {
    const assetIdFor = (hit: (typeof hits)[number]): string => {
      const ailmentTheme = hit.ailmentInflicted ?? hit.themedAilmentId;
      return (ailmentTheme && AILMENT_FX_ASSET[ailmentTheme]) || HIT_FX_ASSET[hit.damageType];
    };
    // Loads each unique FX texture once per round (via one batched Promise.all) rather than once
    // per hit that needs it - a multi-hit target-all round previously reloaded (or re-queued, for
    // an already-loaded texture) the same texture up to once per hit.
    const neededAssetIds = [...new Set(hits.filter((h) => !h.missed).map(assetIdFor))];
    const texturesLoaded = Promise.all(neededAssetIds.map((assetId) => loadSceneTexture(this, assetId)));

    for (const hit of hits) {
      const slot = this.enemySlots.get(hit.targetIndex);
      if (!slot) continue;
      if (hit.missed) {
        playFloatingText(this, slot.sprite.x, slot.sprite.y - slot.sprite.displayHeight / 2 - 20, 'MISS', COLOR_MISS, true);
        continue;
      }
      playOutgoingHitOnSprite(this, slot.sprite);
      playFloatingText(this, slot.sprite.x, slot.sprite.y - slot.sprite.displayHeight / 2 - 20, `-${hit.damage}`, COLOR_DAMAGE);
      const assetId = assetIdFor(hit);
      const { quantity, intensity } = fxIntensityFor(hit.damage, hit.targetMaxHp);
      if (hit.damageType === 'physical') {
        // Slash reads as the weapon making contact; the impact burst (blood, here) follows a beat
        // later as the payoff, instead of both firing in the same instant and blurring together.
        playSlashEffect(this, slot.sprite.x, slot.sprite.y, SLASH_TEXTURE_KEY);
        texturesLoaded.then(() => {
          this.time.delayedCall(90, () => playFxBurst(this, slot.sprite.x, slot.sprite.y, assetId, quantity, intensity));
        }).catch(() => {});
      } else {
        texturesLoaded.then(() => playFxBurst(this, slot.sprite.x, slot.sprite.y, assetId, quantity, intensity)).catch(() => {});
      }
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
    hits: { attackerIndex: number; damage: number; missed: boolean; wasDefended: boolean; hitVfxGroup: 'beast' | 'earthen' | 'spirit' | 'boss' }[],
    playerMaxHp: number,
    fastRounds: boolean,
  ): void {
    const { width, height } = this.scale;
    const anchorX = width / 2;
    // Sits in the visual gap between the back and front enemy rows (BACK_ROW_Y_FRACTION 0.28 /
    // FRONT_ROW_Y_FRACTION 0.52 above) rather than dead-center - centering on 0.5 would land right
    // on top of the front row's own sprites now that they've been raised higher in the arena.
    const anchorY = height * 0.4;
    const INCOMING_TEXT_SIZE = 36;
    // Same batched-load idea as playOutgoingHits - every landed hit's own FX texture, loaded once
    // up front rather than once per hit.
    const neededAssetIds = [...new Set(hits.filter((h) => !h.missed).map((h) => ENEMY_HIT_FX_ASSET[h.hitVfxGroup]))];
    const texturesLoaded = Promise.all(neededAssetIds.map((assetId) => loadSceneTexture(this, assetId)));
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
        const effectiveDamage = hit.wasDefended ? hit.damage / 2 : hit.damage;
        playFloatingText(this, anchorX, anchorY, `-${hit.damage}`, color, hit.wasDefended, INCOMING_TEXT_SIZE);
        playIncomingCameraImpact(this, effectiveDamage, playerMaxHp);
        const assetId = ENEMY_HIT_FX_ASSET[hit.hitVfxGroup];
        const { quantity, intensity } = fxIntensityFor(effectiveDamage, playerMaxHp);
        texturesLoaded.then(() => playFxBurst(this, anchorX, anchorY, assetId, quantity, intensity)).catch(() => {});
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
        slot.ailmentText.destroy();
        slot.targetRing?.destroy();
      },
      useFxSmoke ? DEFEAT_FX_FRAMES : undefined,
    );
  }

  /** Several staggered bursts of `assetId` at random positions scattered across the whole arena -
   *  shared by both playAilmentEffects (every round a damage-dealing ailment ticks) and
   *  playAilmentTakesHold (the bigger moment an ailment is newly inflicted, which just uses a
   *  higher `burstCount`). Every ailment with an FX asset (poison/burn/freeze - see
   *  AILMENT_FX_ASSET) deals real per-turn damage, so there's no "quiet" tick that should read as
   *  less dramatic than this. */
  private burstAilmentFxAcrossArena(assetId: string, burstCount: number): void {
    const { width, height } = this.scale;
    const BURST_STAGGER_MS = 110;
    for (let i = 0; i < burstCount; i++) {
      this.time.delayedCall(i * BURST_STAGGER_MS, () => {
        const x = width * (0.15 + Math.random() * 0.7);
        const y = height * (0.2 + Math.random() * 0.6);
        playFxBurst(this, x, y, assetId);
      });
    }
  }

  /** Fires for every currently-active damage-dealing ailment (poison/burn/freeze), once per round
   *  (see PhaserBattleCanvas's ailmentFxEvent prop) - a still-ticking ailment gets this every round
   *  it deals its damage, not just the round it was first inflicted (see playAilmentTakesHold for
   *  that bigger moment). */
  async playAilmentEffects(ailmentIds: string[]): Promise<void> {
    const PER_ROUND_BURST_COUNT = 4;
    const assetIds = ailmentIds.map((id) => AILMENT_FX_ASSET[id]).filter((id): id is string => !!id);
    await Promise.all(assetIds.map((assetId) => loadSceneTexture(this, assetId)));
    for (const assetId of assetIds) this.burstAilmentFxAcrossArena(assetId, PER_ROUND_BURST_COUNT);
  }

  /** The even bigger, one-time "this ailment just landed" moment - more bursts than a regular
   *  per-round tick (playAilmentEffects), so newly taking an ailment still reads as a distinctly
   *  bigger deal than it continuing to tick. Called once, the round an ailment is newly inflicted
   *  (see CombatScene.tsx's before/after playerAilments diff) - never for an ailment that was
   *  already active and is just continuing to tick. */
  async playAilmentTakesHold(ailmentIds: string[]): Promise<void> {
    const TAKES_HOLD_BURST_COUNT = 8;
    const assetIds = ailmentIds.map((id) => AILMENT_FX_ASSET[id]).filter((id): id is string => !!id);
    await Promise.all(assetIds.map((assetId) => loadSceneTexture(this, assetId)));
    for (const assetId of assetIds) this.burstAilmentFxAcrossArena(assetId, TAKES_HOLD_BURST_COUNT);
  }

  /** The enemy-side equivalent of playAilmentTakesHold above - a player's Skill/weapon successfully
   *  inflicting an ailment on a specific enemy (e.g. Ember Burst landing Burn) bursts that ailment's
   *  FX asset directly on/around *that enemy's own sprite* a few times, rather than scattered
   *  across the whole arena the way the player's own ailments are - there's no single "arena"
   *  position that reads as "this specific enemy" the way anchoring on its sprite does. Called once,
   *  the round an ailment is newly inflicted on this enemy (see CombatScene.tsx's/
   *  EndlessBattlePanel.tsx's before/after enemy-ailments diff), never for one already ticking. A
   *  no-op if the enemy has already been removed (defeated the same round the ailment landed, or a
   *  slot from a stale index). */
  async playEnemyAilmentTakesHold(enemyIndex: number, ailmentIds: string[]): Promise<void> {
    const slot = this.enemySlots.get(enemyIndex);
    if (!slot) return;
    const BURST_COUNT = 5;
    const BURST_STAGGER_MS = 130;
    const assetIds = ailmentIds.map((id) => AILMENT_FX_ASSET[id]).filter((id): id is string => !!id);
    await Promise.all(assetIds.map((assetId) => loadSceneTexture(this, assetId)));
    for (const assetId of assetIds) {
      for (let i = 0; i < BURST_COUNT; i++) {
        this.time.delayedCall(i * BURST_STAGGER_MS, () => {
          // Small random jitter around the sprite (not always dead-center) so five quick bursts
          // in the same spot don't just look like one blob - scaled to that enemy's own displayed
          // size so it still reads as "on top of the enemy image" per the ask, for a boss-size
          // sprite as much as a regular one.
          const jitterX = (Math.random() - 0.5) * slot.sprite.displayWidth * 0.6;
          const jitterY = (Math.random() - 0.5) * slot.sprite.displayHeight * 0.6;
          playFxBurst(this, slot.sprite.x + jitterX, slot.sprite.y + jitterY, assetId, 10);
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
      slot.ailmentText.destroy();
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
