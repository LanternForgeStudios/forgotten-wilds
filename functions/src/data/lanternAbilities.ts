// Authoritative — the client's src/data/lanternAbilities.ts is a display copy only.
//
// A Lantern Ability belongs to whichever lantern grants it (EquipmentDefinition.lanternAbilityIds)
// - it is never learned independently of the item, unlike a Specialty Attack (see
// data/specialAttacks.ts). Fuel is Lantern Oil, not Spirit.

export type LanternAbilityCategory = 'offensive' | 'defensive' | 'healing';

export interface LanternAbilityDefinition {
  id: string;
  name: string;
  category: LanternAbilityCategory;
  oilCost: number;
  description: string;
  /** offensive only */
  power?: number;
  effectiveAgainstFamilies?: string[];
  /** healing only */
  healHp?: number;
  /** defensive only - halves incoming damage for this many of the enemies' turns this round,
   *  same mechanic as Defend but from the lantern rather than bracing bare-handed. */
  damageReductionRounds?: number;
}

export const LANTERN_ABILITIES: Record<string, LanternAbilityDefinition> = {
  'lantern-flame': {
    id: 'lantern-flame',
    name: 'Lantern Flame',
    category: 'offensive',
    oilCost: 8,
    power: 22,
    effectiveAgainstFamilies: ['coalSpirits'],
    description: "Sears a foe with the Keeper's Lantern's flame - especially fierce against Coal Spirits.",
  },
  'steadfast-ember': {
    id: 'steadfast-ember',
    name: 'Steadfast Ember',
    category: 'healing',
    oilCost: 10,
    healHp: 25,
    description:
      "The Miner's Lost Lantern burns with a warmth that outlasted its owner - draw on it to steady yourself and recover HP.",
  },
};
