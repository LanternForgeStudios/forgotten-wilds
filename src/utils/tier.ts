import type { Tier } from '@/types';

export const TIER_LABELS: Record<Tier, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
  legendary: 'Legendary',
};

// Ascending order common -> legendary: grey, green, blue, purple, gold.
export const TIER_COLORS: Record<Tier, string> = {
  common: '#a8a8a0',
  uncommon: '#5cb85c',
  rare: '#4a90d9',
  mythic: '#a35ee0',
  legendary: '#e0a94a',
};
