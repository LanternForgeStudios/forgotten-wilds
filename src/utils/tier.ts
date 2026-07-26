import type { Tier } from '@/types';

export const TIER_LABELS: Record<Tier, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
  legendary: 'Legendary',
};

// Ascending order common -> legendary - shared by anywhere that needs to sort by rarity rather
// than just label/color it (e.g. grouping a crafting/combat item list).
export const TIER_ORDER: Record<Tier, number> = { common: 0, uncommon: 1, rare: 2, mythic: 3, legendary: 4 };

// Ascending order common -> legendary: grey, green, blue, purple, gold.
export const TIER_COLORS: Record<Tier, string> = {
  common: '#a8a8a0',
  uncommon: '#5cb85c',
  rare: '#4a90d9',
  mythic: '#a35ee0',
  legendary: '#e0a94a',
};
