import type { EnemyTier } from '@/types';

export const ENEMY_TIER_LABELS: Record<EnemyTier, string> = {
  regular: 'Regular',
  elite: 'Elite',
  boss: 'Boss',
};

export const ENEMY_TIER_COLORS: Record<EnemyTier, string> = {
  regular: '#a8a8a0',
  elite: '#4a90d9',
  boss: '#e0455b',
};
