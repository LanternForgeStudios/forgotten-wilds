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
  /** Display-only, for the Journal's Echoes/Bosses detail card - not read by any combat math yet.
   *  Unset today for every enemy since no elemental/damage-type system exists to make a weakness
   *  mechanically meaningful; ready for a future elemental-attack system to populate. */
  weaknesses?: string[];
  /** Display-only, for the Journal's Echoes/Bosses detail card - not read by any combat math yet.
   *  Ailment ids (see data/ailments.ts), not display names - JournalOfLegends.tsx resolves each id
   *  to its AILMENTS name at render time. Derived by hand from this enemy's moves' own
   *  inflictsAilmentId in functions/src/data/skills.ts - keep in sync if a move's ailment changes. */
  ailmentsInflicted?: string[];
}
