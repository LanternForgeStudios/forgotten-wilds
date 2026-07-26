import type { Item, ItemEffect, Stats } from '@/types';

// Groups a consumable by which resource its effect restores - shared by CharacterMenu's Crafting
// tab (4 short lists instead of one flat grid) and CombatScene's Items menu (so healing poultices/
// spirit draughts/lantern oil/cures sort together by rarity tier instead of scattering
// alphabetically across the tray).
export type ItemEffectGroup = 'hp' | 'spirit' | 'oil' | 'cure';

export const ITEM_EFFECT_GROUP_ORDER: ItemEffectGroup[] = ['hp', 'spirit', 'oil', 'cure'];

export const ITEM_EFFECT_GROUP_LABELS: Record<ItemEffectGroup, string> = {
  hp: 'Healing Poultices',
  spirit: 'Spirit Draughts',
  oil: 'Lantern Oil',
  cure: 'Ailment Cures',
};

export function itemEffectGroupOf(itemDef: Item | undefined): ItemEffectGroup | undefined {
  if (!itemDef?.effect) return undefined;
  if (itemDef.effect.healHpPercent) return 'hp';
  if (itemDef.effect.healSpiritPercent) return 'spirit';
  if (itemDef.effect.restoreOilPercent) return 'oil';
  if (itemDef.effect.cureAilmentId) return 'cure';
  return undefined;
}

/** Whether this item has any effect that the "Use" button applies at all (as opposed to a key
 *  item/equipment with no direct-use effect). Ailment cures aren't included here - CharacterMenu's
 *  inventory tab is the only caller that gates button *visibility* on this, and ailments only ever
 *  exist mid-combat (never persisted to PlayerSave), so a cure item genuinely has nothing to do
 *  outside combat - correctly showing no Use button there, not a bug. */
export function isUsableEffect(effect: ItemEffect | undefined): boolean {
  return !!effect && !!(effect.healHpPercent || effect.healSpiritPercent || effect.restoreOilPercent);
}

/** Whether using this item would actually change anything right now - the resource(s) it restores
 *  aren't already at max, or (mid-combat only, via activeAilmentIds) it cures an ailment the player
 *  actually has. Display-only mirror of the guard the server itself enforces (useItem.ts/
 *  resolveCombatAction.ts's own wouldHaveEffect) - greys out the button rather than inviting a
 *  click the server would just reject as having no effect. activeAilmentIds defaults to empty for
 *  non-combat callers (CharacterMenu's inventory tab), where there's never an ailment to cure. */
export function itemWouldHaveEffect(effect: ItemEffect | undefined, stats: Stats, activeAilmentIds: string[] = []): boolean {
  if (!effect) return false;
  return (
    (!!effect.healHpPercent && stats.hp < stats.maxHp) ||
    (!!effect.healSpiritPercent && stats.spirit < stats.maxSpirit) ||
    (!!effect.restoreOilPercent && stats.lanternOil < stats.maxLanternOil) ||
    (!!effect.cureAilmentId && activeAilmentIds.includes(effect.cureAilmentId))
  );
}
