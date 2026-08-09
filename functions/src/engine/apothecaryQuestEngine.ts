import { ITEMS } from '../data/items';
import { sellPriceFor } from './pricingEngine';
import type { ApothecaryQuest } from '../shared-types';

const REQUIRED_COUNT_RANGE: [number, number] = [3, 6];
/** Gold bonus rolled on top of the sell-value floor (see rollApothecaryReward) - the floor alone
 *  already beats selling the materials outright, this is the extra "thanks for the help" upside. */
const REWARD_GOLD_BONUS_RANGE: [number, number] = [5, 15];
/** Turning the materials in must never pay worse than just selling them would have - otherwise
 *  there's no reason to ever bother with the quest over the shop's own Sell tab. 0.6 leaves room
 *  for the XP + bonus-item chance below to be the quest's actual selling point over a flat sale. */
const REWARD_GOLD_SELL_VALUE_FLOOR_PCT = 0.6;
/** XP scales with how many materials the request demanded, roughly on par with 1-2 common-enemy
 *  kills per unit (see data/enemies.ts's own xpReward values for this region's tier) - a modest
 *  supplement, not a grind-replacing XP farm. */
const REWARD_XP_PER_MATERIAL_RANGE: [number, number] = [4, 7];
/** Chance the turn-in also grants a bonus item on top of gold - kept modest (a "thanks for the
 *  help" bonus, not a real loot roll) since this quest is infinitely repeatable. */
const REWARD_ITEM_CHANCE = 0.7;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandom<T>(pool: T[]): T | undefined {
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Every non-unique, Common-tier consumable/materials item in the game - the bonus-item pool for
 *  a restock turn-in, same "derive from ITEMS rather than hand-list" approach
 *  dailyChestEngine.ts's own itemIdsByTier already established, computed once at module load
 *  since ITEMS is static content. Not scoped to the requesting shop's own region - a small,
 *  low-stakes bonus roll doesn't need to be thematically regional the way the quest's own
 *  material target does. */
const REWARD_ITEM_POOL = Object.values(ITEMS)
  .filter((i) => !i.unique && (i.category === 'consumable' || i.category === 'materials') && i.tier === 'common')
  .map((i) => i.id);

/** Rolls a brand new restock request for a shop, picking one of its own materialIds at random and
 *  a random target count - see PlayerSave.apothecaryQuests' own doc comment for why this is a
 *  fresh roll rather than authored content. */
export function generateApothecaryQuest(materialIds: string[]): ApothecaryQuest {
  const materialId = pickRandom(materialIds);
  if (!materialId) throw new Error('generateApothecaryQuest called with an empty materialIds pool.');
  return { materialId, requiredCount: randomInt(REQUIRED_COUNT_RANGE[0], REQUIRED_COUNT_RANGE[1]) };
}

export interface ApothecaryReward {
  gold: number;
  xp: number;
  itemIds: string[];
}

/** Rolls the turn-in reward for having handed over `requiredCount` of `materialId` - gold is
 *  floored at REWARD_GOLD_SELL_VALUE_FLOOR_PCT of what selling that many of the material outright
 *  would have paid (plus a small bonus roll), XP scales with requiredCount, and there's a chance
 *  at one bonus common item on top. */
export function rollApothecaryReward(materialId: string, requiredCount: number): ApothecaryReward {
  const sellValue = (sellPriceFor(materialId) ?? 0) * requiredCount;
  const floor = Math.ceil(sellValue * REWARD_GOLD_SELL_VALUE_FLOOR_PCT);
  const gold = floor + randomInt(REWARD_GOLD_BONUS_RANGE[0], REWARD_GOLD_BONUS_RANGE[1]);
  const xp = requiredCount * randomInt(REWARD_XP_PER_MATERIAL_RANGE[0], REWARD_XP_PER_MATERIAL_RANGE[1]);
  const itemIds: string[] = [];
  if (Math.random() < REWARD_ITEM_CHANCE) {
    const bonus = pickRandom(REWARD_ITEM_POOL);
    if (bonus) itemIds.push(bonus);
  }
  return { gold, xp, itemIds };
}
