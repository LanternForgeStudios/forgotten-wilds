import type { TileLayer, TileMap } from '@/types';
import { getAssetDefinition, getAssetUrl } from '@/assets/assetManager';
import type { GridPosition } from '@/hooks/useGridMovement';
import type { MovementState } from '@/animation/characterAnimations';
import styles from './TileGrid.module.css';

export interface GridEntity {
  id: string;
  x: number;
  y: number;
  spriteAssetId: string;
  label?: string;
  /** Which row of the sprite sheet to show (a direction/state row) - only meaningful when the
   *  asset's registry entry has a `frameSize` (e.g. the player sheet). No NPC/enemy asset has one
   *  yet, so this is inert for them today - falls through to the plain <img> path below. */
  frameRow?: number;
  /** Static column to show when not animating (e.g. a resting pose) - defaults to 0. */
  frameColumn?: number;
  movementState?: MovementState;
  /** Small overlay shown above the entity's label (e.g. "!" for an NPC with unheard dialogue) -
   *  pure CSS/text, no art asset needed. */
  badge?: string;
}

interface TileGridProps {
  map: TileMap;
  tilesetAssetId: string;
  tilesetColumns: number;
  player: GridPosition;
  playerSpriteAssetId: string;
  entities?: GridEntity[];
  scale?: number;
  /** Visible window size in exact pixels (typically the real available window area) - maps larger
   *  than this scroll to keep the player centered. Omit for a map that should always render at
   *  full size (no camera). Pixels rather than a tile count so the container always matches the
   *  real viewport with no floor-to-tile rounding gap at the edges. */
  viewportSize?: { width: number; height: number };
  /** Row of the player's sprite sheet to show (from resolveAnimationRow) - the player isn't part of
   *  `entities`, so it gets its own pair of animation props here. */
  playerFrameRow?: number;
  playerMovementState?: MovementState;
}

/** Clamps a 1D camera offset so the focus point is centered without scrolling past the world edge. */
function clampCamera(focusPx: number, viewportPx: number, worldPx: number): number {
  if (worldPx <= viewportPx) return (worldPx - viewportPx) / 2;
  const raw = focusPx - viewportPx / 2;
  return Math.max(0, Math.min(raw, worldPx - viewportPx));
}

/** Renders a Tiled ground layer plus entities (NPCs, player) as absolutely-positioned scaled sprites,
 *  inside a fixed-size viewport that scrolls to follow the player when the map exceeds it. */
export function TileGrid({
  map,
  tilesetAssetId,
  tilesetColumns,
  player,
  playerSpriteAssetId,
  entities = [],
  scale = 3,
  viewportSize,
  playerFrameRow,
  playerMovementState,
}: TileGridProps) {
  const tileSize = map.tileWidth * scale;
  const tilesetUrl = getAssetUrl(tilesetAssetId);
  const ground = map.layers.find((l) => l.name === 'ground');
  const decorationLayers = map.layers
    .filter((l) => /^decorations-\d+$/.test(l.name))
    .sort((a, b) => Number(a.name.split('-')[1]) - Number(b.name.split('-')[1]));
  const overhang = map.layers.find((l) => l.name === 'overhang');

  function renderTileLayer(layer: TileLayer, keyPrefix: string) {
    if (!layer.visible) return null;
    return layer.data.map((gid, index) => {
      if (gid <= 0) return null;
      const localIndex = gid - 1;
      const col = localIndex % tilesetColumns;
      const row = Math.floor(localIndex / tilesetColumns);
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      return (
        <div
          key={`${keyPrefix}-${index}`}
          className={styles.tile}
          style={{
            left: x * tileSize,
            top: y * tileSize,
            width: tileSize,
            height: tileSize,
            opacity: layer.opacity,
            backgroundImage: `url(${tilesetUrl})`,
            backgroundPosition: `-${col * tileSize}px -${row * tileSize}px`,
            backgroundSize: `${tilesetColumns * tileSize}px auto`,
          }}
        />
      );
    });
  }

  // Shared by the player and (in the future) any NPC/enemy whose registry entry gets a
  // `frameSize` - renders via the same backgroundImage/backgroundPosition technique
  // renderTileLayer already uses for tiles, with the walk-cycle driven by a CSS steps()
  // animation (see .walking/.running in TileGrid.module.css) rather than a JS ticker. Falls
  // through to a plain <img> when the asset has no frameSize, so every existing sprite (all
  // NPCs/enemies today) renders exactly as before. Stretches one frame to fill the tile cell
  // (tileSize), matching how a whole static sprite already stretches to fill it today.
  function renderCharacterSprite(spriteAssetId: string, frameRow?: number, movementState?: MovementState, frameColumn = 0) {
    const def = getAssetDefinition(spriteAssetId);
    if (!def.frameSize || !def.dimensions) {
      return <img src={getAssetUrl(spriteAssetId)} alt="" className={styles.entitySprite} />;
    }
    const row = frameRow ?? 0;
    const columns = def.dimensions.width / def.frameSize.width;
    const rows = def.dimensions.height / def.frameSize.height;
    const isAnimating = movementState === 'walking' || movementState === 'running';
    // 120ms/frame matches PLAYER_ANIMATION_LAYOUT.frameDurationMs - the only layout in play today.
    // A future differently-timed sheet would need this threaded through rather than assumed.
    const animationDurationMs = columns * 120;
    return (
      <div
        className={[styles.spriteFrame, isAnimating ? styles[movementState] : ''].join(' ').trim()}
        style={
          {
            width: tileSize,
            height: tileSize,
            backgroundImage: `url(${getAssetUrl(spriteAssetId)})`,
            backgroundSize: `${columns * tileSize}px ${rows * tileSize}px`,
            backgroundPositionY: -row * tileSize,
            backgroundPositionX: isAnimating ? undefined : -frameColumn * tileSize,
            '--frame-width': `${tileSize}px`,
            animationDuration: isAnimating ? `${animationDurationMs}ms` : undefined,
          } as React.CSSProperties
        }
      />
    );
  }

  const worldWidthPx = map.width * tileSize;
  const worldHeightPx = map.height * tileSize;
  const viewportWidthPx = viewportSize?.width ?? worldWidthPx;
  const viewportHeightPx = viewportSize?.height ?? worldHeightPx;

  const cameraX = clampCamera(player.x * tileSize + tileSize / 2, viewportWidthPx, worldWidthPx);
  const cameraY = clampCamera(player.y * tileSize + tileSize / 2, viewportHeightPx, worldHeightPx);

  return (
    <div className={styles.viewport} style={{ width: viewportWidthPx, height: viewportHeightPx }}>
      <div
        className={styles.world}
        style={{
          width: worldWidthPx,
          height: worldHeightPx,
          transform: `translate(${-cameraX}px, ${-cameraY}px)`,
        }}
      >
        {ground && renderTileLayer(ground, 'ground')}
        {decorationLayers.map((l) => renderTileLayer(l, l.name))}

        {entities.map((entity) => (
          <div
            key={entity.id}
            className={styles.entity}
            style={{ left: entity.x * tileSize, top: entity.y * tileSize, width: tileSize, height: tileSize }}
          >
            {entity.label && <span className={styles.entityLabel}>{entity.label}</span>}
            {entity.badge && <span className={styles.entityBadge}>{entity.badge}</span>}
            {renderCharacterSprite(entity.spriteAssetId, entity.frameRow, entity.movementState, entity.frameColumn)}
          </div>
        ))}

        <div
          className={styles.entity}
          style={{ left: player.x * tileSize, top: player.y * tileSize, width: tileSize, height: tileSize }}
        >
          {renderCharacterSprite(playerSpriteAssetId, playerFrameRow, playerMovementState)}
        </div>

        {overhang && renderTileLayer(overhang, 'overhang')}
      </div>
    </div>
  );
}
