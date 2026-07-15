import { getAssetDefinition } from '@/assets/assetManager';

/** Enemy battle sprites are authored for the full-screen combat view (128x128 regular, 256x256
 *  boss) - too large for a small "something's nearby" map marker (a field-encounter icon, or a
 *  boss's fixed map-object marker). These are the target on-screen sizes for that map-marker
 *  context specifically; the combat screen's own rendering is untouched. */
const REGULAR_ENEMY_MAP_ICON_SIZE = 64;
const BOSS_MAP_ICON_SIZE = 128;

/** A GridEntity.displayScale multiplier that shrinks an enemy's existing battle sprite down to
 *  map-marker size, computed from the asset's own registered width rather than a hardcoded ratio -
 *  stays correct if a differently-sized enemy sprite is ever added, not just today's 128/256. No
 *  new art needed; this only affects the map-marker's render size, not the sprite file itself. */
export function enemyMapIconScale(spriteAssetId: string, isBoss: boolean): number {
  const targetSize = isBoss ? BOSS_MAP_ICON_SIZE : REGULAR_ENEMY_MAP_ICON_SIZE;
  if (!spriteAssetId) return 1;
  const nativeWidth = getAssetDefinition(spriteAssetId).dimensions?.width ?? targetSize;
  return targetSize / nativeWidth;
}
