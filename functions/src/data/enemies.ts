// Authoritative — the client's src/data/enemies.ts is a display copy only.

export interface EnemyMove {
  skillId: string;
  weight: number;
  unlocksAtHpFraction?: number;
}

export interface LootDrop {
  itemId: string;
  chance: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  family: 'mothlings' | 'restlessMiners' | 'coalSpirits' | 'boss';
  isBoss: boolean;
  stats: { maxHp: number; attack: number; defense: number; speed: number };
  moves: EnemyMove[];
  xpReward: number;
  goldReward: number;
  lootTable: LootDrop[];
}

export const ENEMIES: Record<string, EnemyDefinition> = {
  mothling: {
    id: 'mothling',
    name: 'Mothling',
    family: 'mothlings',
    isBoss: false,
    stats: { maxHp: 28, attack: 7, defense: 3, speed: 9 },
    moves: [
      { skillId: 'attack', weight: 3 },
      { skillId: 'mothling-dustwing', weight: 1 },
    ],
    xpReward: 12,
    goldReward: 6,
    lootTable: [{ itemId: 'moth-dust', chance: 0.4, minQuantity: 1, maxQuantity: 2 }],
  },
  'greater-mothling': {
    id: 'greater-mothling',
    name: 'Greater Mothling',
    family: 'mothlings',
    isBoss: false,
    stats: { maxHp: 42, attack: 10, defense: 5, speed: 11 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'mothling-dustwing', weight: 2 },
    ],
    xpReward: 20,
    goldReward: 11,
    lootTable: [{ itemId: 'moth-dust', chance: 0.5, minQuantity: 1, maxQuantity: 3 }],
  },
  'restless-miner': {
    id: 'restless-miner',
    name: 'Restless Miner',
    family: 'restlessMiners',
    isBoss: false,
    stats: { maxHp: 34, attack: 9, defense: 6, speed: 6 },
    moves: [
      { skillId: 'attack', weight: 3 },
      { skillId: 'miner-pickaxe-swing', weight: 1 },
    ],
    xpReward: 15,
    goldReward: 9,
    lootTable: [{ itemId: 'rusted-token', chance: 0.35, minQuantity: 1, maxQuantity: 1 }],
  },
  'foreman-wraith': {
    id: 'foreman-wraith',
    name: 'Foreman Wraith',
    family: 'restlessMiners',
    isBoss: false,
    stats: { maxHp: 50, attack: 12, defense: 8, speed: 7 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'miner-pickaxe-swing', weight: 2 },
    ],
    xpReward: 24,
    goldReward: 14,
    lootTable: [{ itemId: 'rusted-token', chance: 0.45, minQuantity: 1, maxQuantity: 2 }],
  },
  'coal-spirit': {
    id: 'coal-spirit',
    name: 'Coal Spirit',
    family: 'coalSpirits',
    isBoss: false,
    stats: { maxHp: 30, attack: 8, defense: 4, speed: 8 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'coalspirit-cinderburst', weight: 2 },
    ],
    xpReward: 14,
    goldReward: 8,
    lootTable: [{ itemId: 'ember-shard', chance: 0.4, minQuantity: 1, maxQuantity: 2 }],
  },
  'coal-wraith': {
    id: 'coal-wraith',
    name: 'Coal Wraith',
    family: 'coalSpirits',
    isBoss: false,
    stats: { maxHp: 46, attack: 11, defense: 6, speed: 9 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'coalspirit-cinderburst', weight: 3 },
    ],
    xpReward: 22,
    goldReward: 13,
    lootTable: [{ itemId: 'ember-shard', chance: 0.5, minQuantity: 1, maxQuantity: 3 }],
  },
  'coalbound-warden': {
    id: 'coalbound-warden',
    name: 'The Coalbound Warden',
    family: 'boss',
    isBoss: true,
    stats: { maxHp: 140, attack: 13, defense: 8, speed: 8 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'warden-coal-slam', weight: 2 },
      { skillId: 'warden-warden-wrath', weight: 2, unlocksAtHpFraction: 0.5 },
    ],
    xpReward: 150,
    goldReward: 80,
    lootTable: [{ itemId: 'wardens-ember-heart', chance: 1, minQuantity: 1, maxQuantity: 1 }],
  },
};

export const ENCOUNTER_TABLES: Record<string, { enemyId: string; weight: number }[]> = {
  'ironwood-trail': [
    { enemyId: 'mothling', weight: 3 },
    { enemyId: 'greater-mothling', weight: 1 },
  ],
  'hollow-rail-mine': [
    { enemyId: 'restless-miner', weight: 2 },
    { enemyId: 'foreman-wraith', weight: 1 },
    { enemyId: 'coal-spirit', weight: 2 },
    { enemyId: 'coal-wraith', weight: 1 },
  ],
};
