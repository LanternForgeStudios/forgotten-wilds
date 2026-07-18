import Phaser from 'phaser';
import type { TileLayer, TileMap } from '@/types';
import type { GridPosition } from '@/hooks/useGridMovement';
import type { MovementState } from '@/animation/characterAnimations';
import { PLAYER_ANIMATION_LAYOUT } from '@/animation/characterAnimations';
import { getAssetDefinition } from '@/assets/assetManager';
import { createCharacterAnimations, animationKey } from './animationDefs';
import { ensureParticleTexture } from './battleEffects';
import { loadSceneTexture } from './textureLoader';
import type { GridEntity } from '@/components/exploration/PhaserExplorationCanvas';

/** The glide-between-tiles animation duration - matches useGridMovement.ts's own default
 *  `stepIntervalMs` (220ms, the throttle gating how often a new step is allowed) so one tile's
 *  glide finishes exactly as the next step becomes available, instead of visibly sitting still for
 *  the gap between them. Previously 120ms against a 220ms throttle, which left ~100ms of dead time
 *  at the end of every single tile - the actual cause of movement reading as "choppy, one block at
 *  a time" despite already being tweened, not a missing-tween problem. */
const GLIDE_MS = 220;
/** Dash's own faster glide duration - matches useGridMovement.ts's dashStepIntervalMs (100ms
 *  default), the same "glide finishes exactly as the next step becomes available" reasoning as
 *  GLIDE_MS above, just at Dash's higher step rate. */
const DASH_GLIDE_MS = 100;
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
/** The viewport zoom level (see useExplorationViewport.ts's desktop `scale`) that every character/
 *  structure/decoration asset's own pixel dimensions are authored against - a 48x64 sprite is
 *  meant to render at exactly 48x64 screen pixels at this reference zoom, not be force-fit to
 *  exactly one tile's width. Player/entity render scale is this reference's ratio to whatever the
 *  actual current viewport scale is (1.0 on desktop, ~0.67 on mobile's 2x scale), so an asset
 *  authored larger or smaller than one tile stays proportionally larger or smaller than a tile at
 *  any zoom level, instead of every entity being stretched/squashed to exactly fill one tile -
 *  which is what silently made the 48x64 player placeholder (48 native width happens to equal one
 *  tile's width at 3x) look barely taller than a 32x32 NPC placeholder than intended. */
const REFERENCE_VIEWPORT_SCALE = 3;
/** --fw-text-dim - a dusty tan/grey, reads as ground dust rather than anything magical. */
const DASH_DUST_COLOR = 0xb8a888;
/** Real FX-pack sheet for the Dash dust puff, replacing the generated dot texture once loaded -
 *  see spawnDashDust's textures.exists guard for the (rare) fallback path. */
const DASH_DUST_FX_ASSET_ID = 'fx.smoke-puff';

interface EntityVisual {
  sprite: Phaser.GameObjects.Sprite;
  /** The spriteAssetId this sprite was last textured with - lets upsertEntity detect a change
   *  (e.g. another player switching skins via Profile mid-session, presence entity id stays the
   *  same) and retexture in place instead of leaving the sprite stuck on its original asset. */
  spriteAssetId: string;
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
  /** tileSize ÷ the map's own native tile pixel size (map.tileWidth) - the actual current viewport
   *  zoom level (3 on desktop, 2 on mobile - see useExplorationViewport.ts), used to scale
   *  character/entity sprites relative to REFERENCE_VIEWPORT_SCALE. Set once per loadMap call. */
  private viewportScale = REFERENCE_VIEWPORT_SCALE;
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
    // Fire-and-forget: spawnDashDust checks textures.exists before using this, falling back to the
    // dot texture on the rare chance a dash is triggered before this finishes loading.
    loadSceneTexture(this, DASH_DUST_FX_ASSET_ID).catch(() => {});
    this.onReady?.();
  }

  /** Builds the tilemap for a location from the already-parsed TileMap (see the plan's "Tiled
   *  loading" section for why this doesn't re-feed raw Tiled JSON through Phaser's own loader) -
   *  a no-op if this exact location is already loaded, since this gets called on every relevant
   *  prop change from React, not just on a real location transition. */
  async loadMap(map: TileMap, tileSize: number): Promise<void> {
    this.tileSize = tileSize;
    // Kept current even on the early-return no-op path below (a resize/mobile-toggle while
    // staying in the same location still changes tileSize, and setPlayer/setEntities read this
    // independently of whether the tile layers themselves get rebuilt).
    this.viewportScale = tileSize / map.tileWidth;
    if (this.currentMapKey === map.locationId) return;
    this.currentMapKey = map.locationId;
    this.mapJustChanged = true;
    this.mapGeneration++;
    const generation = this.mapGeneration;

    for (const layer of this.mapLayers) layer.destroy();
    this.mapLayers = [];

    await Promise.all(map.tilesets.map((t) => loadSceneTexture(this, t.assetId)));
    // A newer loadMap call (a second, rapid location transition) has since superseded this one -
    // abort rather than build tile layers for a location we've already left.
    if (generation !== this.mapGeneration) return;

    const ground = map.layers.find((l) => l.name === 'ground');
    const decorationLayers = map.layers
      .filter((l) => /^decorations-\d+$/.test(l.name))
      .sort((a, b) => Number(a.name.split('-')[1]) - Number(b.name.split('-')[1]));
    // 'overhang' (no suffix) and 'overhang-N' are both valid - mirrors decorations-N so a map only
    // needs a numbered suffix once it actually has more than one overhang layer to stack.
    const overhangLayers = map.layers
      .filter((l) => /^overhang(-\d+)?$/.test(l.name))
      .sort((a, b) => Number(a.name.split('-')[1] ?? 0) - Number(b.name.split('-')[1] ?? 0));
    const orderedLayers = [ground, ...decorationLayers, ...overhangLayers].filter((l): l is TileLayer => !!l);

    const tilemap = this.make.tilemap({
      tileWidth: map.tileWidth,
      tileHeight: map.tileHeight,
      width: map.width,
      height: map.height,
    });
    // One Phaser tileset object per embedded tileset the map declares, each anchored at its own
    // firstgid so a single layer can freely mix tiles from more than one source image (e.g. a grass
    // ground pack + a separate tree/prop pack) - standard Phaser/Tiled multi-tileset usage.
    // putTileAt below passes `gid - 1` (a 0-based index, since Tiled gid 0 means "empty"), so
    // addTilesetImage's own `gid` (its internal *0-based* index-space anchor - confirmed by reading
    // Phaser's source: BuildTilesetIndex populates `tiles[firstgid..firstgid+total-1]`, and the old
    // single-tileset call never passed a `gid` at all, defaulting to 0) must be `t.firstgid - 1`,
    // not the raw 1-based Tiled firstgid - passing the raw value left `tiles[0]` (and every other
    // index in tileset 0's range) unpopulated, throwing inside Phaser's PutTileAt on the very first
    // tile and aborting the whole layer build silently (the map rendered as a blank room).
    // Each tileset's OWN tileWidth/tileHeight (t.tileWidth/t.tileHeight) is used here, not the map's
    // - a tileset can have a different native tile size than the map's grid (e.g. a 32px prop sheet
    // on this 16px-grid map), same as Tiled itself always does. Passing the map's size for every
    // tileset instead cropped the wrong sub-region of any tileset whose native size differed from
    // it - exactly why the game's tiles looked different/wrong compared to opening the same file in
    // the real Tiled editor, which always reads each tileset's own declared size correctly.
    const tilesets = map.tilesets.map((t) => tilemap.addTilesetImage(t.assetId, t.assetId, t.tileWidth, t.tileHeight, 0, 0, t.firstgid - 1)!);

    orderedLayers.forEach((layer, index) => {
      const phaserLayer = tilemap.createBlankLayer(layer.name, tilesets, 0, 0, map.width, map.height)!;
      layer.data.forEach((gid, i) => {
        if (gid <= 0) return;
        phaserLayer.putTileAt(gid - 1, i % map.width, Math.floor(i / map.width));
      });
      phaserLayer.setAlpha(layer.opacity).setVisible(layer.visible).setScale(this.viewportScale);
      const overhangMatch = /^overhang(?:-(\d+))?$/.exec(layer.name);
      // Multiple overhang-N layers stack in numeric order among themselves, all still above every
      // decoration/entity layer (OVERHANG_DEPTH is already higher than any plausible decoration count).
      phaserLayer.setDepth(overhangMatch ? OVERHANG_DEPTH + Number(overhangMatch[1] ?? 0) : index);
      this.mapLayers.push(phaserLayer);
    });
  }

  private async ensurePlayerAnimations(spriteAssetId: string): Promise<void> {
    if (this.playerTextureKey === spriteAssetId) return;
    await loadSceneTexture(this, spriteAssetId);
    // Only a real spritesheet (frameSize set - today just the sprite.player fallback) has rows to
    // build a walk/run animation from. The male/female skins (Player.skin) are still a single
    // static frame with no frameSize - creating frame-numbered animations against those found zero
    // real frames every time (Phaser logs one warning per missing frame, then the broken Animation
    // object throws when setPlayer's walking/running branch below tries to play it), on every
    // single scene-level map transition since PhaserExplorationCanvas mounts a fresh
    // ExplorationScene per Town/Overworld/Dungeon switch. Matches setEntities' own `if
    // (def.frameSize)` guard for NPCs - this is that same guard, just missing here until now.
    if (getAssetDefinition(spriteAssetId).frameSize) {
      createCharacterAnimations(this.anims, spriteAssetId, PLAYER_ANIMATION_LAYOUT);
    }
    this.playerTextureKey = spriteAssetId;
  }

  /** Positions/animates the player sprite - the player isn't part of `entities`, matching the old
   *  TileGrid's own player-is-rendered-separately convention. */
  async setPlayer(pos: GridPosition, spriteAssetId: string, frameRow: number, movementState: MovementState): Promise<void> {
    this.playerGeneration++;
    const generation = this.playerGeneration;
    // Captured before ensurePlayerAnimations (which updates playerTextureKey itself) - true only
    // when an already-created sprite's skin actually changed mid-session (see UserProfile's Skin
    // tab); always false on the very first setPlayer call, since there's no sprite yet to retexture.
    const textureChanged = !!this.playerSprite && this.playerTextureKey !== spriteAssetId;
    await this.ensurePlayerAnimations(spriteAssetId);
    // A newer setPlayer call has since superseded this one - its own (more current) state has
    // already been applied, so don't let this stale continuation clobber it.
    if (generation !== this.playerGeneration) return;

    const snapInstantly = !this.playerSprite || this.mapJustChanged;
    this.mapJustChanged = false;
    if (!this.playerSprite) {
      // Origin (0.5, 1) anchors the sprite's feet to its tile position rather than its center, so
      // taller-than-one-tile art (see the 3/4-view scale spec and REFERENCE_VIEWPORT_SCALE above)
      // lines up with the ground instead of floating with its vertical midpoint on the tile - the
      // 48x64 player placeholder is already taller than one 48px tile at desktop's reference scale.
      this.playerSprite = this.add.sprite(0, 0, spriteAssetId).setOrigin(0.5, 1).setDepth(ENTITY_DEPTH);
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
    } else if (textureChanged) {
      // The player changed skin mid-session (Profile's Skin tab) - swap the existing sprite's
      // texture instead of leaving it stuck on whichever skin it was first created with.
      this.playerSprite.setTexture(spriteAssetId);
    }
    const sprite = this.playerSprite;
    sprite.setScale(this.viewportScale / REFERENCE_VIEWPORT_SCALE);

    const targetX = pos.x * this.tileSize + this.tileSize / 2;
    const targetY = pos.y * this.tileSize + this.tileSize;
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
      const duration = movementState === 'running' ? DASH_GLIDE_MS : GLIDE_MS;
      this.tweens.add({ targets: sprite, x: targetX, y: targetY, duration, ease: 'Linear' });
    }

    // A static single-frame skin (male/female - see Player.skin) has no rows/frames to animate or
    // select at all - only a real spritesheet (frameSize set, today just the sprite.player
    // fallback) has any frame beyond its one default. Matches setEntities' own `if
    // (def.frameSize)` guard for NPCs below.
    if (getAssetDefinition(spriteAssetId).frameSize) {
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
  }

  /** One small puff of dust, at ground level (behind the player sprite) rather than on top of
   *  it - a short-lived one-shot emitter, same explode()-then-destroy pattern as BattleScene's
   *  defeat effect. Uses the real FX-pack smoke-puff sheet once loaded; falls back to the
   *  generated dot texture (tinted dust-brown) for the rare dash that fires before create()'s
   *  fire-and-forget load finishes. Not routed through battleEffects' playFxBurst - this needs its
   *  own emitter reference to set depth (dust renders behind the player sprite), which that shared
   *  helper doesn't expose. */
  private spawnDashDust(x: number, y: number): void {
    const useFx = this.textures.exists(DASH_DUST_FX_ASSET_ID);
    const emitter = this.add.particles(x, y, useFx ? DASH_DUST_FX_ASSET_ID : PARTICLE_TEXTURE_KEY, {
      ...(useFx ? { frame: [0, 1, 2, 3] } : { tint: DASH_DUST_COLOR }),
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
      await loadSceneTexture(this, entity.spriteAssetId);
      // A newer setEntities call has since superseded this one (the player left this location
      // before the texture finished loading) - abort rather than create an orphaned sprite for
      // an entity that's no longer part of the current location's entity list.
      if (generation !== this.entityGeneration) return;
      // Same feet-anchor origin as the player sprite (setPlayer above) - see its comment.
      const sprite = this.add.sprite(0, 0, entity.spriteAssetId).setOrigin(0.5, 1).setDepth(ENTITY_DEPTH);
      visual = { sprite, spriteAssetId: entity.spriteAssetId };
      this.entityVisuals.set(entity.id, visual);
    } else if (visual.spriteAssetId !== entity.spriteAssetId) {
      // Same entity id (e.g. another player's presence doc), different sprite - most notably
      // another player switching skins via Profile mid-session. Load (if not already cached) and
      // retexture in place rather than leaving the sprite stuck on its original asset.
      await loadSceneTexture(this, entity.spriteAssetId);
      if (generation !== this.entityGeneration) return;
      visual.sprite.setTexture(entity.spriteAssetId);
      visual.spriteAssetId = entity.spriteAssetId;
    }

    const def = getAssetDefinition(entity.spriteAssetId);
    const x = entity.x * this.tileSize + this.tileSize / 2;
    const y = entity.y * this.tileSize + this.tileSize;
    visual.sprite.setScale((this.viewportScale / REFERENCE_VIEWPORT_SCALE) * (entity.displayScale ?? 1));
    if (def.frameSize) {
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
    }

    const v = visual;
    // Computed from the sprite's own displayHeight (rather than a fixed tileSize/2) so the label
    // floats above the actual sprite top - matters once taller-than-one-tile art lands, since the
    // sprite's origin is now feet-anchored (bottom), not center.
    const repositionAttachments = () => {
      v.label?.setPosition(v.sprite.x, v.sprite.y - v.sprite.displayHeight - 8);
      v.badge?.setPosition(v.sprite.x + this.tileSize / 2 - 4, v.sprite.y - v.sprite.displayHeight - 2);
    };
    if (justCreated || this.mapJustChanged) {
      this.tweens.killTweensOf(visual.sprite);
      visual.sprite.setPosition(x, y);
    } else {
      this.tweens.add({ targets: visual.sprite, x, y, duration: GLIDE_MS, ease: 'Linear', onUpdate: repositionAttachments });
    }

    const labelY = y - visual.sprite.displayHeight - 8;
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
    const badgeY = y - visual.sprite.displayHeight - 2;
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
