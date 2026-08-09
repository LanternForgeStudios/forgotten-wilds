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
  /** healing only - fraction of maxHp restored (0-1), same convention as ItemEffect.healHpPercent.
   *  Scaled up further by the equipped lantern's own Oil upgrade tier - see engine/combatMath.ts's
   *  scaleLanternAbility. */
  healHpPercent?: number;
  /** defensive only - halves incoming damage for this many of the enemies' turns this round,
   *  same mechanic as Defend but from the lantern rather than bracing bare-handed. Also scaled up
   *  by oil tier (+1 round per 5 tiers) - see scaleLanternAbility. */
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
    healHpPercent: 0.2,
    description:
      "The Miner's Lost Lantern burns with a warmth that outlasted its owner - draw on it to steady yourself and recover HP.",
  },
  'still-waters-calm': {
    id: 'still-waters-calm',
    name: 'Still Waters Calm',
    category: 'defensive',
    oilCost: 10,
    damageReductionRounds: 2,
    description:
      "The Lantern of Still Waters settles the current around you - incoming blows land as gently as ripples for a moment.",
  },
  'open-skies-renewal': {
    id: 'open-skies-renewal',
    name: 'Open Skies Renewal',
    category: 'healing',
    oilCost: 12,
    healHpPercent: 0.25,
    description:
      'The Lantern of Open Skies breathes clean mountain wind through you, carrying off the worst of your wounds.',
  },
  'ancient-roots-reach': {
    id: 'ancient-roots-reach',
    name: "Ancient Roots' Reach",
    category: 'offensive',
    oilCost: 10,
    power: 24,
    effectiveAgainstFamilies: ['silentEchoes'],
    description:
      'The Lantern of Ancient Roots burns with light older than the forest\'s own corruption - especially fierce against Silent Echoes.',
  },
  'astral-ward': {
    id: 'astral-ward',
    name: 'Astral Ward',
    category: 'defensive',
    oilCost: 12,
    damageReductionRounds: 2,
    description:
      'The Lantern of Forgotten Stars wraps you in a thin veil of dead starlight - incoming blows land as if from somewhere much farther away.',
  },
  'resolve-renewed': {
    id: 'resolve-renewed',
    name: 'Resolve Renewed',
    category: 'healing',
    oilCost: 14,
    healHpPercent: 0.3,
    description:
      "The Lantern of Winter's Resolve remembers what it means to endure - draw on it to steady yourself and recover HP, the same warmth every Keeper before you once carried.",
  },
};
