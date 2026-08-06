import { LANTERN_OIL_UPGRADE_GATES } from '@/data';
import type { PlayerEquipment } from '@/types';

/** Every legendary lantern id that `shopId`'s General Store currently offers an Oil upgrade for -
 *  owned by the player (in inventory or equipped) AND unlocked (that region's boss already
 *  defeated). Shared by Shop.tsx (to render the Upgrade tab's rows) and TownScene.tsx (to decide
 *  whether talking to that shop's keeper should offer an Upgrade Lantern/Buy-Sell choice at all) -
 *  a shop with nothing eligible behaves exactly as it did before this feature existed. */
export function eligibleLanternUpgrades(
  shopId: string,
  inventory: { itemId: string }[],
  equipment: PlayerEquipment | undefined,
  bossesDefeated: string[],
): string[] {
  return Object.entries(LANTERN_OIL_UPGRADE_GATES)
    .filter(([lanternId, gate]) => {
      if (gate.shopId !== shopId || !bossesDefeated.includes(gate.bossId)) return false;
      return inventory.some((i) => i.itemId === lanternId) || equipment?.lantern === lanternId;
    })
    .map(([lanternId]) => lanternId);
}
