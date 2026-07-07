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

/** The 3 tiers a fight can be at - every enemy rolls a 1-50 level that scales its stats/rewards up
 *  (see rollEnemyLevel/scaledEnemyStats in combatEngine.ts). Boss tier grows at a steeper rate
 *  (BOSS_STAT_GROWTH_PER_LEVEL) than Regular/Elite, so its authored stat lead stays meaningful. */
export type EnemyTier = 'regular' | 'elite' | 'boss';

export interface EnemyDefinition {
  id: string;
  name: string;
  family: 'mothlings' | 'restlessMiners' | 'coalSpirits' | 'cliffDwellers' | 'waterSpirits' | 'briarSpirits' | 'boss';
  tier: EnemyTier;
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
    tier: 'regular',
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
    tier: 'elite',
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
    tier: 'regular',
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
    tier: 'elite',
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
    tier: 'regular',
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
    tier: 'elite',
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
  'cliff-wolf': {
    id: 'cliff-wolf',
    name: 'Cliff Wolf',
    family: 'cliffDwellers',
    tier: 'regular',
    isBoss: false,
    stats: { maxHp: 30, attack: 8, defense: 4, speed: 10 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'ridge-ambush', weight: 2 },
    ],
    xpReward: 13,
    goldReward: 7,
    lootTable: [{ itemId: 'wolf-fang', chance: 0.4, minQuantity: 1, maxQuantity: 2 }],
  },
  'ridge-hawk': {
    id: 'ridge-hawk',
    name: 'Ridge Hawk',
    family: 'cliffDwellers',
    tier: 'elite',
    isBoss: false,
    stats: { maxHp: 44, attack: 11, defense: 6, speed: 12 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'ridge-ambush', weight: 3 },
    ],
    xpReward: 21,
    goldReward: 12,
    lootTable: [{ itemId: 'wolf-fang', chance: 0.5, minQuantity: 1, maxQuantity: 3 }],
  },
  'pool-wisp': {
    id: 'pool-wisp',
    name: 'Pool Wisp',
    family: 'waterSpirits',
    tier: 'regular',
    isBoss: false,
    stats: { maxHp: 29, attack: 7, defense: 4, speed: 9 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'wisp-chill', weight: 2 },
    ],
    xpReward: 14,
    goldReward: 8,
    lootTable: [{ itemId: 'silver-droplet', chance: 0.4, minQuantity: 1, maxQuantity: 2 }],
  },
  'falls-siren': {
    id: 'falls-siren',
    name: 'Falls Siren',
    family: 'waterSpirits',
    tier: 'elite',
    isBoss: false,
    stats: { maxHp: 45, attack: 10, defense: 6, speed: 11 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'wisp-chill', weight: 3 },
    ],
    xpReward: 22,
    goldReward: 13,
    lootTable: [{ itemId: 'silver-droplet', chance: 0.5, minQuantity: 1, maxQuantity: 3 }],
  },
  'briar-wraith': {
    id: 'briar-wraith',
    name: 'Briar Wraith',
    family: 'briarSpirits',
    tier: 'regular',
    isBoss: false,
    stats: { maxHp: 32, attack: 9, defense: 5, speed: 7 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'briar-thorn-lash', weight: 2 },
    ],
    xpReward: 16,
    goldReward: 9,
    lootTable: [{ itemId: 'withered-bramble', chance: 0.4, minQuantity: 1, maxQuantity: 2 }],
  },
  'cemetery-shade': {
    id: 'cemetery-shade',
    name: 'Cemetery Shade',
    family: 'briarSpirits',
    tier: 'elite',
    isBoss: false,
    stats: { maxHp: 48, attack: 12, defense: 7, speed: 8 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'briar-thorn-lash', weight: 3 },
    ],
    xpReward: 24,
    goldReward: 14,
    lootTable: [{ itemId: 'withered-bramble', chance: 0.5, minQuantity: 1, maxQuantity: 3 }],
  },
  'coalbound-warden': {
    id: 'coalbound-warden',
    name: 'The Coalbound Warden',
    family: 'boss',
    tier: 'boss',
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
  'raven-ridge': [
    { enemyId: 'cliff-wolf', weight: 3 },
    { enemyId: 'ridge-hawk', weight: 1 },
  ],
  'whisper-falls': [
    { enemyId: 'pool-wisp', weight: 3 },
    { enemyId: 'falls-siren', weight: 1 },
  ],
  'black-briar-forest': [
    { enemyId: 'briar-wraith', weight: 3 },
    { enemyId: 'cemetery-shade', weight: 1 },
  ],
};

/** Which locations a boss's optional "adds" (0-3 additional enemies that can join the fight) may
 *  be drawn from - the boss's own region. Includes the boss's own home location, since its own
 *  trash mobs are a legitimate add source too. Bosses must never appear in ENCOUNTER_TABLES
 *  themselves (adds are drawn from those tables, and a boss showing up as an "add" would be a
 *  content-authoring bug), so no filtering for that case is needed here. */
export const BOSS_REGION_LOCATIONS: Record<string, string[]> = {
  'coalbound-warden': ['ironwood-trail', 'raven-ridge', 'whisper-falls', 'black-briar-forest', 'hollow-rail-mine'],
};
