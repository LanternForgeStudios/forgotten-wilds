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
}

/** Renders a Tiled ground layer plus entities (NPCs, player) as absolutely-positioned scaled sprites. */
export function TileGrid({
  map,
  tilesetAssetId,
  tilesetColumns,
  player,
  playerSpriteAssetId,
  entities = [],
  scale = 3,
}: TileGridProps) {
  const tileSize = map.tileWidth * scale;
  const tilesetUrl = getAssetUrl(tilesetAssetId);
  const ground = map.layers.find((l) => l.name === 'ground');

  return (
    <div
      className={styles.viewport}
      style={{ width: map.width * tileSize, height: map.height * tileSize }}
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
  );
}
