import Phaser from 'phaser';
import type { TileLayer, TileMap } from '@/types';
import type { GridPosition } from '@/hooks/useGridMovement';
import type { MovementState } from '@/animation/characterAnimations';
import { PLAYER_ANIMATION_LAYOUT } from '@/animation/characterAnimations';
import { getAssetDefinition, getAssetUrl } from '@/assets/assetManager';
import { createCharacterAnimations, animationKey } from './animationDefs';
import { ensureParticleTexture } from './battleEffects';
import type { GridEntity } from '@/components/exploration/PhaserExplorationCanvas';

/** Matches TileGrid.module.css's `transition: left/top 120ms linear` - the glide-between-tiles feel. */
const GLIDE_MS = 120;
/** Always renders above every tile layer and every entity/player sprite - same as the old DOM
 *  renderer's document order (overhang divs are always painted last). */
const OVERHANG_DEPTH = 1000;
/** Entities and the player sit between decoration layers and the overhang. Deliberately higher
 *  than any plausible decoration-layer count. */
const ENTITY_DEPTH = 500;
/** Same one-time generated 4x4 white-square texture ensureParticleTexture already sets up for
 *  BattleScene's defeat effect - reused here rather than duplicating the Graphics->texture
 *  boilerplate, tinted differently per call site. */
const PARTICLE_TEXTURE_KEY = 'fx-dot';
/** --fw-text-dim - a dusty tan/grey, reads as ground dust rather than anything magical. */
const DASH_DUST_COLOR = 0xb8a888;

interface EntityVisual {
  sprite: Phaser.GameObjects.Sprite;
  label?: Phaser.GameObjects.Text;
  badge?: Phaser.GameObjects.Text;
}

/** The one generic exploration-rendering Phaser Scene - loaded once per Game instance, reused
 *  across every location (mirrors useLocationExploration.ts's "one hook, many locations" shape,
 *  not "one Scene per location"). Every method here is called imperatively by
 *  PhaserExplorationCanvas.tsx in response to prop changes - this scene owns no game logic
 *  (collision, spawn, transitions) at all, that all stays in the existing React hooks. */
export class ExplorationScene extends Phaser.Scene {
  private tileSize = 48;
  private mapLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  private currentMapKey: string | null = null;
  /** Set whenever loadMap actually swaps to a different location - consumed by the next
   *  setPlayer call so a location transition snaps the player to the new spawn point instantly
   *  instead of gliding from the previous map's pixel coordinates. */
  private mapJustChanged = false;

  private playerSprite: Phaser.GameObjects.Sprite | null = null;
  private playerTextureKey: string | null = null;
  /** Same race-guard pattern as entityGeneration - only matters once the player sprite's own
   *  texture can change at runtime (e.g. a future equipment-appearance swap), but guarded now for
   *  consistency rather than waiting for that bug to actually happen. */
  private playerGeneration = 0;

  private entityVisuals = new Map<string, EntityVisual>();
  /** Incremented on every setEntities call - lets an in-flight upsertEntity (awaiting a texture
   *  load) detect it's been superseded by a newer call (e.g. the player left this location before
   *  the load finished) and bail out, instead of creating an orphaned sprite for an entity that's
   *  no longer part of the current location. See setEntities/upsertEntity. */
  private entityGeneration = 0;
  /** Same idea as entityGeneration, for loadMap's own await (texture load before building tile
   *  layers) - guards against a rapid double location-transition racing itself. */
  private mapGeneration = 0;
  private onReady?: () => void;

  constructor(onReady?: () => void) {
    super({ key: 'ExplorationScene' });
    this.onReady = onReady;
  }

  create() {
    // Nothing to eagerly load - map/sprite textures load lazily per call below, since maps and
    // sprites change at runtime (location transitions) outside the normal preload()/create()
    // lifecycle. Signals readiness so the React bridge knows it's safe to start calling the
    // imperative API. This is a constructor-injected callback invoked from *inside* create()
    // (not an event the caller subscribes to from outside) because Phaser boots a scene
    // asynchronously - `this.events`/`this.load`/every other scene system is undefined until
    // boot completes, so the caller can't safely listen on `scene.events` immediately after
    // `new Phaser.Game(...)` returns (confirmed the hard way: that's exactly what threw
    // "Cannot read properties of undefined (reading 'once')").
    ensureParticleTexture(this, PARTICLE_TEXTURE_KEY);
    this.onReady?.();
  }

  /** Loads (if not already cached) a plain image or spritesheet texture and resolves once ready.
   *  Safe to call for a texture that's already loaded (resolves immediately, no re-fetch). */
  private loadTexture(assetId: string): Promise<void> {
    if (this.textures.exists(assetId)) return Promise.resolve();
    const def = getAssetDefinition(assetId);
    const url = getAssetUrl(assetId);
    return new Promise((resolve) => {
      if (def.frameSize) {
        this.load.spritesheet(assetId, url, { frameWidth: def.frameSize.width, frameHeight: def.frameSize.height });
      } else {
        this.load.image(assetId, url);
      }
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  /** Builds the tilemap for a location from the already-parsed TileMap (see the plan's "Tiled
   *  loading" section for why this doesn't re-feed raw Tiled JSON through Phaser's own loader) -
   *  a no-op if this exact location is already loaded, since this gets called on every relevant
   *  prop change from React, not just on a real location transition. */
  async loadMap(map: TileMap, tileSize: number): Promise<void> {
    this.tileSize = tileSize;
    if (this.currentMapKey === map.locationId) return;
    this.currentMapKey = map.locationId;
    this.mapJustChanged = true;
    this.mapGeneration++;
    const generation = this.mapGeneration;

    for (const layer of this.mapLayers) layer.destroy();
    this.mapLayers = [];

    await this.loadTexture(map.tilesetAssetId);
    // A newer loadMap call (a second, rapid location transition) has since superseded this one -
    // abort rather than build tile layers for a location we've already left.
    if (generation !== this.mapGeneration) return;

    const ground = map.layers.find((l) => l.name === 'ground');
    const decorationLayers = map.layers
      .filter((l) => /^decorations-\d+$/.test(l.name))
      .sort((a, b) => Number(a.name.split('-')[1]) - Number(b.name.split('-')[1]));
    const overhang = map.layers.find((l) => l.name === 'overhang');
    const orderedLayers = [ground, ...decorationLayers, overhang].filter((l): l is TileLayer => !!l);

    const tilemap = this.make.tilemap({
      tileWidth: map.tileWidth,
      tileHeight: map.tileHeight,
      width: map.width,
      height: map.height,
    });
    const tileset = tilemap.addTilesetImage(map.tilesetAssetId, map.tilesetAssetId, map.tileWidth, map.tileHeight)!;

    const scale = tileSize / map.tileWidth;
    orderedLayers.forEach((layer, index) => {
      const phaserLayer = tilemap.createBlankLayer(layer.name, tileset, 0, 0, map.width, map.height)!;
      layer.data.forEach((gid, i) => {
        if (gid <= 0) return;
        phaserLayer.putTileAt(gid - 1, i % map.width, Math.floor(i / map.width));
      });
      phaserLayer.setAlpha(layer.opacity).setVisible(layer.visible).setScale(scale);
      phaserLayer.setDepth(layer.name === 'overhang' ? OVERHANG_DEPTH : index);
      this.mapLayers.push(phaserLayer);
    });
  }

  private async ensurePlayerAnimations(spriteAssetId: string): Promise<void> {
    if (this.playerTextureKey === spriteAssetId) return;
    await this.loadTexture(spriteAssetId);
    createCharacterAnimations(this.anims, spriteAssetId, PLAYER_ANIMATION_LAYOUT);
    this.playerTextureKey = spriteAssetId;
  }

  /** Positions/animates the player sprite - the player isn't part of `entities`, matching the old
   *  TileGrid's own player-is-rendered-separately convention. */
  async setPlayer(pos: GridPosition, spriteAssetId: string, frameRow: number, movementState: MovementState): Promise<void> {
    this.playerGeneration++;
    const generation = this.playerGeneration;
    await this.ensurePlayerAnimations(spriteAssetId);
    // A newer setPlayer call has since superseded this one - its own (more current) state has
    // already been applied, so don't let this stale continuation clobber it.
    if (generation !== this.playerGeneration) return;
    const def = getAssetDefinition(spriteAssetId);

    const snapInstantly = !this.playerSprite || this.mapJustChanged;
    this.mapJustChanged = false;
    if (!this.playerSprite) {
      this.playerSprite = this.add.sprite(0, 0, spriteAssetId).setDepth(ENTITY_DEPTH);
      // setCamera has its own `if (this.playerSprite) camera.startFollow(...)` check, but
      // setCamera and setPlayer are two independent React effects that can run in either order -
      // and setPlayer's own texture load (ensurePlayerAnimations, just awaited above) means the
      // sprite frequently doesn't exist yet the first time setCamera runs, especially on a slower
      // connection. Establishing follow here too, the instant the sprite actually exists, means
      // camera tracking works on the very first load regardless of which effect wins the race,
      // instead of only recovering once some later, unrelated resize re-triggers setCamera
      // (confirmed by hand: this is exactly why rotating the phone "fixed" a dead camera - the
      // resize was incidentally the first thing to re-run setCamera after the sprite existed).
      this.cameras.main.startFollow(this.playerSprite);
    }
    const sprite = this.playerSprite;
    if (def.frameSize) {
      sprite.setScale(this.tileSize / def.frameSize.width);
    } else {
      sprite.setScale(this.tileSize / (def.dimensions?.width ?? this.tileSize));
    }

    const targetX = pos.x * this.tileSize + this.tileSize / 2;
    const targetY = pos.y * this.tileSize + this.tileSize / 2;
    // 'running' only ever means mid-Dash today (see useGridMovement.ts) - kick up a puff of dust
    // from where the player is leaving, behind them as they go. Skipped on an instant snap (a
    // location transition, not real movement) since there's no "leaving from" position to kick
    // dust up from.
    if (!snapInstantly && movementState === 'running') {
      this.spawnDashDust(sprite.x, sprite.y);
    }
    if (snapInstantly) {
      this.tweens.killTweensOf(sprite);
      sprite.setPosition(targetX, targetY);
    } else {
      this.tweens.add({ targets: sprite, x: targetX, y: targetY, duration: GLIDE_MS, ease: 'Linear' });
    }

    if (movementState === 'walking' || movementState === 'running') {
      const key = animationKey(spriteAssetId, movementState, pos.facing);
      if (sprite.anims.currentAnim?.key !== key) sprite.play(key);
    } else {
      // Idle has no dedicated row on the sheet - `frameRow` is already resolveDisplayRow's
      // fallback-to-frame-0-of-the-walking-row answer, computed by the caller (same as the old
      // TileGrid's `playerFrameRow` prop) rather than re-derived here.
      sprite.anims.stop();
      sprite.setFrame(frameRow * PLAYER_ANIMATION_LAYOUT.frameCount);
    }
  }

  /** One small puff of dust, at ground level (behind the player sprite) rather than on top of
   *  it - a short-lived one-shot emitter, same explode()-then-destroy pattern as BattleScene's
   *  defeat effect. */
  private spawnDashDust(x: number, y: number): void {
    const emitter = this.add.particles(x, y, PARTICLE_TEXTURE_KEY, {
      tint: DASH_DUST_COLOR,
      speed: { min: 15, max: 40 },
      lifespan: 280,
      scale: { start: 0.8, end: 0 },
      quantity: 4,
      emitting: false,
    });
    emitter.setDepth(ENTITY_DEPTH - 1);
    emitter.explode(4);
    this.time.delayedCall(320, () => emitter.destroy());
  }

  /** Reconciles entity sprites/labels/badges against the incoming array - the manual equivalent
   *  of React's `.map()`+`key` reconciliation, which doesn't exist in Phaser. */
  setEntities(entities: GridEntity[]): void {
    this.entityGeneration++;
    const generation = this.entityGeneration;
    const seen = new Set<string>();
    for (const entity of entities) {
      seen.add(entity.id);
      this.upsertEntity(entity, generation);
    }
    for (const [id, visual] of this.entityVisuals) {
      if (seen.has(id)) continue;
      visual.sprite.destroy();
      visual.label?.destroy();
      visual.badge?.destroy();
      this.entityVisuals.delete(id);
    }
  }

  private async upsertEntity(entity: GridEntity, generation: number): Promise<void> {
    let visual = this.entityVisuals.get(entity.id);
    let justCreated = false;
    if (!visual) {
      justCreated = true;
      await this.loadTexture(entity.spriteAssetId);
      // A newer setEntities call has since superseded this one (the player left this location
      // before the texture finished loading) - abort rather than create an orphaned sprite for
      // an entity that's no longer part of the current location's entity list.
      if (generation !== this.entityGeneration) return;
      const sprite = this.add.sprite(0, 0, entity.spriteAssetId).setDepth(ENTITY_DEPTH);
      visual = { sprite };
      this.entityVisuals.set(entity.id, visual);
    }

    const def = getAssetDefinition(entity.spriteAssetId);
    const x = entity.x * this.tileSize + this.tileSize / 2;
    const y = entity.y * this.tileSize + this.tileSize / 2;
    if (def.frameSize) {
      visual.sprite.setScale(this.tileSize / def.frameSize.width);
      const row = entity.frameRow ?? 0;
      const column = entity.frameColumn ?? 0;
      if (entity.movementState === 'walking' || entity.movementState === 'running') {
        // Not exercised by any entity yet (only the player has a frameSize sheet today), but
        // wired the same way as setPlayer for when an NPC/enemy gets one.
        const key = animationKey(entity.spriteAssetId, entity.movementState, 'down');
        if (this.anims.exists(key) && visual.sprite.anims.currentAnim?.key !== key) visual.sprite.play(key);
      } else {
        visual.sprite.anims.stop();
        visual.sprite.setFrame(row * PLAYER_ANIMATION_LAYOUT.frameCount + column);
      }
    } else {
      visual.sprite.setScale(this.tileSize / (def.dimensions?.width ?? this.tileSize));
    }

    const v = visual;
    const repositionAttachments = () => {
      v.label?.setPosition(v.sprite.x, v.sprite.y - this.tileSize / 2 - 8);
      v.badge?.setPosition(v.sprite.x + this.tileSize / 2 - 4, v.sprite.y - this.tileSize / 2 - 2);
    };
    if (justCreated || this.mapJustChanged) {
      this.tweens.killTweensOf(visual.sprite);
      visual.sprite.setPosition(x, y);
    } else {
      this.tweens.add({ targets: visual.sprite, x, y, duration: GLIDE_MS, ease: 'Linear', onUpdate: repositionAttachments });
    }

    const labelY = y - this.tileSize / 2 - 8;
    if (entity.label) {
      if (!visual.label) {
        visual.label = this.add
          .text(x, labelY, entity.label, {
            fontSize: '10px',
            color: '#b8a888',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: { x: 4, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setDepth(ENTITY_DEPTH + 1);
      } else {
        visual.label.setText(entity.label).setPosition(x, labelY);
      }
    } else if (visual.label) {
      visual.label.destroy();
      visual.label = undefined;
    }

    const badgeX = x + this.tileSize / 2 - 4;
    const badgeY = y - this.tileSize / 2 - 2;
    if (entity.badge) {
      if (!visual.badge) {
        visual.badge = this.add
          .text(badgeX, badgeY, entity.badge, {
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#ffd166',
            backgroundColor: '#c0392b',
            padding: { x: 2, y: 0 },
          })
          .setOrigin(0.5, 1)
          .setDepth(ENTITY_DEPTH + 1);
      } else {
        visual.badge.setPosition(badgeX, badgeY);
      }
    } else if (visual.badge) {
      visual.badge.destroy();
      visual.badge = undefined;
    }
  }

  /** Replaces clampCamera() entirely. `centerOn=true` on setBounds is required (not a Phaser
   *  default) - without it, bounds smaller than the viewport just lock the camera in place rather
   *  than centering the smaller world, silently dropping the "center the world when it's smaller
   *  than the viewport" behavior the old DOM camera math had. Re-call whenever the active map
   *  changes, since world size differs per location. */
  setCamera(worldWidthPx: number, worldHeightPx: number, viewportWidthPx: number, viewportHeightPx: number): void {
    const camera = this.cameras.main;
    camera.setViewport(0, 0, viewportWidthPx, viewportHeightPx);
    camera.setBounds(0, 0, worldWidthPx, worldHeightPx, true);
    if (this.playerSprite) camera.startFollow(this.playerSprite);
  }

  setViewport(viewportSize: { width: number; height: number }): void {
    this.scale.resize(viewportSize.width, viewportSize.height);
  }
}
