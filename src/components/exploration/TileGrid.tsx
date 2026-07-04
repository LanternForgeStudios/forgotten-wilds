import type { TileMap } from '@/types';
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
  /** Visible window size in tiles. Maps larger than this scroll to keep the player centered.
   *  Omit for a map that should always render at full size (no camera). */
  viewportTiles?: { width: number; height: number };
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
  viewportTiles,
}: TileGridProps) {
  const tileSize = map.tileWidth * scale;
  const tilesetUrl = getAssetUrl(tilesetAssetId);
  const ground = map.layers.find((l) => l.name === 'ground');

  const worldWidthPx = map.width * tileSize;
  const worldHeightPx = map.height * tileSize;
  const viewportWidthPx = (viewportTiles?.width ?? map.width) * tileSize;
  const viewportHeightPx = (viewportTiles?.height ?? map.height) * tileSize;

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
        {ground?.data.map((gid, index) => {
          if (gid <= 0) return null;
          const localIndex = gid - 1;
          const col = localIndex % tilesetColumns;
          const row = Math.floor(localIndex / tilesetColumns);
          const x = index % map.width;
          const y = Math.floor(index / map.width);
          return (
            <div
              key={index}
              className={styles.tile}
              style={{
                left: x * tileSize,
                top: y * tileSize,
                width: tileSize,
                height: tileSize,
                backgroundImage: `url(${tilesetUrl})`,
                backgroundPosition: `-${col * tileSize}px -${row * tileSize}px`,
                backgroundSize: `${tilesetColumns * tileSize}px auto`,
              }}
            />
          );
        })}

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
      </div>
    </div>
  );
}
