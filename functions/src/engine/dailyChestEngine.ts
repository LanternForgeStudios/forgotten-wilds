import { ITEMS } from '../data/items';
import { EQUIPMENT } from '../data/equipment';
import { ELITE_CHEST_LEVEL_THRESHOLD } from '../data/dailyChest';

export type ChestTier = 'standard' | 'elite';

export interface ChestRewardResult {
  gold: number;
  premiumCurrency: number;
  itemIds: string[];
}

/** Non-unique consumable/materials ids at the given tiers, derived from ITEMS rather than
 *  hand-listed - stays correct as content grows instead of drifting out of sync with a
 *  hardcoded pool. */
function itemIdsByTier(tiers: string[]): string[] {
  return Object.values(ITEMS)
    .filter((i) => !i.unique && (i.category === 'consumable' || i.category === 'materials') && tiers.includes(i.tier))
    .map((i) => i.id);
}

/** Non-unique equipment ids at the given tiers - see itemIdsByTier's own doc comment. Every
 *  Mythic/Legendary equipment item today is a specific named milestone reward (none are
 *  `unique: false`), so filtering on `!unique` alone would still be safe, but tiers is passed
 *  explicitly anyway so a chest's max tier is a visible, deliberate choice here rather than an
 *  incidental consequence of what happens to be unique today. */
function equipmentIdsByTier(tiers: string[]): string[] {
  return Object.values(EQUIPMENT)
    .filter((e) => !e.unique && tiers.includes(e.tier))
    .map((e) => e.id);
}

const STANDARD_ITEM_POOL = itemIdsByTier(['common']);
const ELITE_ITEM_POOL = itemIdsByTier(['uncommon', 'rare']);
const STANDARD_EQUIPMENT_POOL = equipmentIdsByTier(['common', 'uncommon']);
const ELITE_EQUIPMENT_POOL = equipmentIdsByTier(['uncommon', 'rare']);
// Shared by both tiers - Elite rolls against this pool far more often than Standard does (see
// bonusRareEquipmentChance below), rather than each tier having its own separate rare pool.
const RARE_EQUIPMENT_POOL = equipmentIdsByTier(['rare']);

interface ChestTierConfig {
  goldRange: [number, number];
  guaranteedItemPool: string[];
  bonusGoldChance: number;
  bonusGoldRange: [number, number];
  bonusMaterialChance: number;
  materialPool: string[];
  bonusEquipmentChance: number;
  equipmentPool: string[];
  bonusRareEquipmentChance: number;
  bonusPremiumChance: number;
  premiumRange: [number, number];
}

// Every reward slot capped at Rare tier, even for Elite - Mythic/Legendary are reserved for named
// milestone rewards elsewhere (docs/Mytherra-Equipment_breakdown.md's one-legendary-per-region
// design), not something a repeatable timed chest should be able to hand out.
const TIER_CONFIG: Record<ChestTier, ChestTierConfig> = {
  standard: {
    goldRange: [20, 40],
    guaranteedItemPool: STANDARD_ITEM_POOL,
    bonusGoldChance: 0.4,
    bonusGoldRange: [10, 20],
    bonusMaterialChance: 0.5,
    materialPool: STANDARD_ITEM_POOL,
    bonusEquipmentChance: 0.15,
    equipmentPool: STANDARD_EQUIPMENT_POOL,
    bonusRareEquipmentChance: 0.05,
    bonusPremiumChance: 0.1,
    premiumRange: [5, 10],
  },
  elite: {
    goldRange: [60, 120],
    guaranteedItemPool: ELITE_ITEM_POOL,
    bonusGoldChance: 0.5,
    bonusGoldRange: [30, 60],
    bonusMaterialChance: 0.6,
    materialPool: ELITE_ITEM_POOL,
    bonusEquipmentChance: 0.35,
    equipmentPool: ELITE_EQUIPMENT_POOL,
    bonusRareEquipmentChance: 0.15,
    bonusPremiumChance: 0.25,
    premiumRange: [15, 30],
  },
};

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandom(pool: string[]): string | undefined {
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function chestTierForLevel(level: number): ChestTier {
  return level >= ELITE_CHEST_LEVEL_THRESHOLD ? 'elite' : 'standard';
}

/** One guaranteed currency reward, one guaranteed consumable/material, and up to 3 independent
 *  chance-gated bonus rolls (bonus gold, a material, one equipment piece - rare rolled first and
 *  only falling back to the tier's normal equipment pool on a miss, so a chest can't award two
 *  equipment pieces in the same claim - and premium currency). Elite's ranges/chances are
 *  strictly better than Standard's per the design doc, not just a bigger flat bonus. */
export function rollChestRewards(tier: ChestTier): ChestRewardResult {
  const config = TIER_CONFIG[tier];
  const itemIds: string[] = [];
  let gold = randomInt(config.goldRange[0], config.goldRange[1]);
  let premiumCurrency = 0;

  const guaranteed = pickRandom(config.guaranteedItemPool);
  if (guaranteed) itemIds.push(guaranteed);

  if (Math.random() < config.bonusGoldChance) {
    gold += randomInt(config.bonusGoldRange[0], config.bonusGoldRange[1]);
  }
  if (Math.random() < config.bonusMaterialChance) {
    const material = pickRandom(config.materialPool);
    if (material) itemIds.push(material);
  }
  if (Math.random() < config.bonusRareEquipmentChance) {
    const rare = pickRandom(RARE_EQUIPMENT_POOL);
    if (rare) itemIds.push(rare);
  } else if (Math.random() < config.bonusEquipmentChance) {
    const equipment = pickRandom(config.equipmentPool);
    if (equipment) itemIds.push(equipment);
  }
  if (Math.random() < config.bonusPremiumChance) {
    premiumCurrency += randomInt(config.premiumRange[0], config.premiumRange[1]);
  }

  return { gold, premiumCurrency, itemIds };
}
