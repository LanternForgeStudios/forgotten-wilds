export interface EnemyStats {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface LootDrop {
  itemId: string;
  chance: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface EnemyMove {
  skillId: string;
  weight: number;
  /** If set, this move only becomes available once enemy HP is at or below this fraction (boss phases). */
  unlocksAtHpFraction?: number;
}

/** Regular and Elite additionally roll a 1-5 level in combat that scales stats/rewards up; Boss
 *  tier never rolls a level - its difficulty is exactly what's authored here. */
export type EnemyTier = 'regular' | 'elite' | 'boss';

export interface Enemy {
  id: string;
  name: string;
  family: 'mothlings' | 'restlessMiners' | 'coalSpirits' | 'cliffDwellers' | 'waterSpirits' | 'briarSpirits' | 'boss';
  tier: EnemyTier;
  isBoss: boolean;
  battleSpriteAssetId: string;
  stats: EnemyStats;
  moves: EnemyMove[];
  xpReward: number;
  goldReward: number;
  lootTable: LootDrop[];
  loreBlurb: string;
}
