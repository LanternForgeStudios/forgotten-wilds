import { SKILLS } from '@/data';
import { itemDisplayName, itemIconAssetId, groupRewardItemIds } from './itemName';

export interface RewardLine {
  key: string;
  icon?: string;
  label: string;
}

export interface RewardLineInput {
  xp?: number;
  gold?: number;
  spiritEssence?: number;
  premiumCurrency?: number;
  /** Flat, possibly-duplicated item ids (e.g. 3 separate Moth Dust drops) - grouped into one
   *  "Item x3" line per distinct id via groupRewardItemIds, same as every existing reward list. */
  itemIds?: string[];
  /** Specialty Attack ids just learned - no dedicated icon exists for skills yet (only items/
   *  equipment/currency/ailments have registry.ts icons today), so these render as a plain
   *  "New Specialty: X" line with no image. */
  skillIds?: string[];
  /** Ready-to-display, already-worded lines with no numeric reward behind them (e.g. "Lantern Oil
   *  Upgrades Unlocked - Iron Mountains General Store") - rendered last, plain text, no icon. */
  notices?: string[];
}

/** Builds the {key, icon?, label} line list a RewardPopup renders, from whatever mix of xp/gold/
 *  premium currency/items/skills a single event actually granted - shared by every reward
 *  acknowledgment moment (chest opens, world-item pickups, quest completions, combat victory)
 *  instead of each screen hand-rolling its own line-building logic. Omits a line entirely for any
 *  field that's zero/empty, so a quest reward with no gold doesn't show "0 Gold". */
export function buildRewardLines(input: RewardLineInput): RewardLine[] {
  const lines: RewardLine[] = [];
  if (input.xp) lines.push({ key: 'xp', label: `${input.xp} XP` });
  if (input.gold) lines.push({ key: 'gold', icon: 'icon.currency.gold', label: `${input.gold} Gold` });
  if (input.spiritEssence) {
    lines.push({ key: 'spirit-essence', icon: 'icon.currency.spirit-essence', label: `${input.spiritEssence} Spirit Essence` });
  }
  if (input.premiumCurrency) {
    lines.push({ key: 'premium', icon: 'icon.currency.premium-currency', label: `${input.premiumCurrency} Premium Currency` });
  }
  for (const { itemId, count } of groupRewardItemIds(input.itemIds ?? [])) {
    lines.push({
      key: `item-${itemId}`,
      icon: itemIconAssetId(itemId),
      label: `${itemDisplayName(itemId)}${count > 1 ? ` x${count}` : ''}`,
    });
  }
  for (const skillId of input.skillIds ?? []) {
    const skill = SKILLS.find((s) => s.id === skillId);
    lines.push({ key: `skill-${skillId}`, label: `New Specialty: ${skill?.name ?? skillId}` });
  }
  (input.notices ?? []).forEach((notice, i) => lines.push({ key: `notice-${i}`, label: notice }));
  return lines;
}
