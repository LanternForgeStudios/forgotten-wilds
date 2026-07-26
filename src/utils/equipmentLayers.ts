import { EQUIPMENT } from '@/data';
import type { EquipmentSlot, PlayerEquipment } from '@/types';

/** Resolves the player's currently-equipped items into the layer-sprite list
 *  PhaserExplorationCanvas stacks on top of the base body (see
 *  docs/Equipment-Layering-Plan.md) - shared by every exploration scene (Town/Overworld/Dungeon)
 *  rather than duplicating this loop three times. Layer art is keyed by gender only (not
 *  appearance - equipment fits identically regardless of skin tone/hair), and is optional per
 *  item, so this resolves to [] for any equipped item that has no layerSpriteAssetId yet (every
 *  item today, until Phase 3/4 ship real art). */
export function resolveEquipmentLayers(
  equipment: PlayerEquipment | undefined,
  gender: 'male' | 'female',
): { slot: EquipmentSlot; spriteAssetId: string }[] {
  if (!equipment) return [];
  const layers: { slot: EquipmentSlot; spriteAssetId: string }[] = [];
  for (const slot of Object.keys(equipment) as EquipmentSlot[]) {
    const itemId = equipment[slot];
    if (!itemId) continue;
    const spriteAssetId = EQUIPMENT.find((e) => e.id === itemId)?.layerSpriteAssetId?.[gender];
    if (spriteAssetId) layers.push({ slot, spriteAssetId });
  }
  return layers;
}
