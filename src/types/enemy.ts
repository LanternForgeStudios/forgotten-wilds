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

export interface Enemy {
  id: string;
  name: string;
  family: 'mothlings' | 'restlessMiners' | 'coalSpirits' | 'boss';
  tier: number;
  isBoss: boolean;
  battleSpriteAssetId: string;
  stats: EnemyStats;
  moves: EnemyMove[];
  xpReward: number;
  goldReward: number;
  lootTable: LootDrop[];
  loreBlurb: string;
}
