import { ITEMS } from '../data/items';
import type { ApothecaryQuest } from '../shared-types';

const REQUIRED_COUNT_RANGE: [number, number] = [3, 6];
const REWARD_GOLD_RANGE: [number, number] = [15, 35];
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
  itemIds: string[];
}

/** Rolls the turn-in reward - always some gold, a chance at one bonus common item. */
export function rollApothecaryReward(): ApothecaryReward {
  const gold = randomInt(REWARD_GOLD_RANGE[0], REWARD_GOLD_RANGE[1]);
  const itemIds: string[] = [];
  if (Math.random() < REWARD_ITEM_CHANCE) {
    const bonus = pickRandom(REWARD_ITEM_POOL);
    if (bonus) itemIds.push(bonus);
  }
  return { gold, itemIds };
}
