// Display copy only — functions/src/data/lanternAbilities.ts is authoritative for combat resolution.

export type LanternAbilityCategory = 'offensive' | 'defensive' | 'healing';

export interface LanternAbility {
  id: string;
  name: string;
  category: LanternAbilityCategory;
  oilCost: number;
  description: string;
}

export const LANTERN_ABILITIES: LanternAbility[] = [
  {
    id: 'lantern-flame',
    name: 'Lantern Flame',
    category: 'offensive',
    oilCost: 8,
    description: "Sears a foe with the Keeper's Lantern's flame - especially fierce against Coal Spirits.",
  },
  {
    id: 'steadfast-ember',
    name: 'Steadfast Ember',
    category: 'healing',
    oilCost: 10,
    description:
      "The Miner's Lost Lantern burns with a warmth that outlasted its owner - draw on it to steady yourself and recover HP.",
  },
];
