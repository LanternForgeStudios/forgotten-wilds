import type { TileLayer, TileMap } from '@/types';
import { getAssetUrl } from '@/assets/assetManager';
import type { GridPosition } from '@/hooks/useGridMovement';
import styles from './TileGrid.module.css';

export interface GridEntity {
  id: string;
  x: number;
  y: number;
  spriteAssetId: string;
  label?: string;
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
            <img src={getAssetUrl(entity.spriteAssetId)} alt="" className={styles.entitySprite} />
          </div>
        ))}

        <div
          className={styles.entity}
          style={{ left: player.x * tileSize, top: player.y * tileSize, width: tileSize, height: tileSize }}
        >
          <img src={getAssetUrl(playerSpriteAssetId)} alt="" className={styles.entitySprite} />
        </div>

        {overhang && renderTileLayer(overhang, 'overhang')}
      </div>
    </div>
  );
}
