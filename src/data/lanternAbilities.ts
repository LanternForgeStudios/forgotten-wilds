// Display copy only — functions/src/data/lanternAbilities.ts is authoritative for combat resolution.

export type LanternAbilityCategory = 'offensive' | 'defensive' | 'healing';

export interface LanternAbility {
  id: string;
  name: string;
  category: LanternAbilityCategory;
  oilCost: number;
  description: string;
  /** A registry.ts audio asset id, played instead of the generic sfx.combat-hit when this ability
   *  resolves - same convention as Skill.sfxAssetId (see that type's own doc comment). */
  sfxAssetId?: string;
}

export const LANTERN_ABILITIES: LanternAbility[] = [
  {
    id: 'lantern-flame',
    name: 'Lantern Flame',
    category: 'offensive',
    oilCost: 8,
    description: "Sears a foe with the Keeper's Lantern's flame - especially fierce against Coal Spirits.",
    sfxAssetId: 'sfx.lanternAbility.lantern-flame',
  },
  {
    id: 'steadfast-ember',
    name: 'Steadfast Ember',
    category: 'healing',
    oilCost: 10,
    description:
      "The Miner's Lost Lantern burns with a warmth that outlasted its owner - draw on it to steady yourself and recover HP.",
    sfxAssetId: 'sfx.lanternAbility.steadfast-ember',
  },
  {
    id: 'still-waters-calm',
    name: 'Still Waters Calm',
    category: 'defensive',
    oilCost: 10,
    description:
      "The Lantern of Still Waters settles the current around you - incoming blows land as gently as ripples for a moment.",
  },
  {
    id: 'open-skies-renewal',
    name: 'Open Skies Renewal',
    category: 'healing',
    oilCost: 12,
    description:
      'The Lantern of Open Skies breathes clean mountain wind through you, carrying off the worst of your wounds.',
  },
  {
    id: 'ancient-roots-reach',
    name: "Ancient Roots' Reach",
    category: 'offensive',
    oilCost: 10,
    description:
      'The Lantern of Ancient Roots burns with light older than the forest\'s own corruption - especially fierce against Silent Echoes.',
  },
  {
    id: 'astral-ward',
    name: 'Astral Ward',
    category: 'defensive',
    oilCost: 12,
    description:
      'The Lantern of Forgotten Stars wraps you in a thin veil of dead starlight - incoming blows land as if from somewhere much farther away.',
  },
];
