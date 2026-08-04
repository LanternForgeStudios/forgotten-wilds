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
  family:
    | 'mothlings'
    | 'restlessMiners'
    | 'coalSpirits'
    | 'cliffDwellers'
    | 'waterSpirits'
    | 'briarSpirits'
    | 'swampCrocs'
    | 'bogWitches'
    | 'rougarou'
    | 'windSpirits'
    | 'prairieWolves'
    | 'boss';
  tier: EnemyTier;
  isBoss: boolean;
  stats: { maxHp: number; attack: number; defense: number; speed: number };
  moves: EnemyMove[];
  xpReward: number;
  goldReward: number;
  lootTable: LootDrop[];
  /** The one of the 3 player damage types (see data/skills.ts's DamageType) this family takes 1.5x
   *  damage from - checked in combatEngine.ts's resolveOffensiveHits against whichever damageType
   *  the player's attack/skill/lanternAbility actually used. Also what the Journal's Echoes card
   *  displays as this enemy's Weakness. */
  weaknessDamageType: 'physical' | 'spirit' | 'lantern';
  /** Boss-only: which quest must be completed before startEncounter.ts will let this boss be
   *  challenged. Data-driven per-boss rather than a separate hardcoded id-to-quest map, so a new
   *  boss's prerequisite lives right alongside its other authored content. */
  prerequisiteQuestId?: string;
  /** Which ailments (data/ailments.ts ids) a player's Skill/Lantern Ability can actually inflict on
   *  this enemy - an authored allowlist, not "everything except what it inflicts itself" (see
   *  combatMath.ts's enemyIsVulnerableTo). Every family gets a curated 2-3 ailment subset rather
   *  than all 5 remaining ones, for real pick-the-right-ailment strategy rather than "anything but
   *  its own signature works." Deliberately never includes the ailment this enemy's own moves
   *  inflict (immune to what it deals out) - checked by enemies.test.ts so a future authoring
   *  mistake here fails a test instead of shipping quietly. First-pass thematic assignment, not
   *  playtested - expect these to need real balance tuning. */
  vulnerableAilments: string[];
}

export const ENEMIES: Record<string, EnemyDefinition> = {
  mothling: {
    id: 'mothling',
    name: 'Mothling',
    family: 'mothlings',
    tier: 'regular',
    isBoss: false,
    weaknessDamageType: 'lantern',
    vulnerableAilments: ['freeze', 'poison', 'stun'],
    stats: { maxHp: 28, attack: 7, defense: 3, speed: 9 },
    moves: [
      { skillId: 'attack', weight: 3 },
      { skillId: 'mothling-dustwing', weight: 1 },
    ],
    xpReward: 12,
    goldReward: 6,
    lootTable: [
      { itemId: 'moth-dust', chance: 0.4, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'healing-poultice', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      // mothling-dustwing inflicts Blind - eye-drops cure it.
      { itemId: 'eye-drops', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'greater-mothling': {
    id: 'greater-mothling',
    name: 'Greater Mothling',
    family: 'mothlings',
    tier: 'elite',
    isBoss: false,
    weaknessDamageType: 'lantern',
    vulnerableAilments: ['freeze', 'poison', 'stun'],
    stats: { maxHp: 42, attack: 10, defense: 5, speed: 11 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'mothling-dustwing', weight: 2 },
    ],
    xpReward: 20,
    goldReward: 11,
    lootTable: [
      { itemId: 'moth-dust', chance: 0.5, minQuantity: 1, maxQuantity: 3 },
      { itemId: 'healing-poultice', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'eye-drops', chance: 0.18, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'restless-miner': {
    id: 'restless-miner',
    name: 'Restless Miner',
    family: 'restlessMiners',
    tier: 'regular',
    isBoss: false,
    weaknessDamageType: 'physical',
    vulnerableAilments: ['poison', 'burn', 'silence'],
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
    weaknessDamageType: 'physical',
    vulnerableAilments: ['poison', 'burn', 'silence'],
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
    weaknessDamageType: 'spirit',
    vulnerableAilments: ['freeze', 'stun', 'silence'],
    stats: { maxHp: 30, attack: 8, defense: 4, speed: 8 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'coalspirit-cinderburst', weight: 2 },
    ],
    xpReward: 14,
    goldReward: 8,
    lootTable: [
      { itemId: 'ember-shard', chance: 0.4, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'lantern-oil', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      // coalspirit-cinderburst inflicts Burn - burn-salve cures it.
      { itemId: 'burn-salve', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'coal-wraith': {
    id: 'coal-wraith',
    name: 'Coal Wraith',
    family: 'coalSpirits',
    tier: 'elite',
    isBoss: false,
    weaknessDamageType: 'spirit',
    vulnerableAilments: ['freeze', 'stun', 'silence'],
    stats: { maxHp: 46, attack: 11, defense: 6, speed: 9 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'coalspirit-cinderburst', weight: 3 },
    ],
    xpReward: 22,
    goldReward: 13,
    lootTable: [
      { itemId: 'ember-shard', chance: 0.5, minQuantity: 1, maxQuantity: 3 },
      { itemId: 'lantern-oil', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'burn-salve', chance: 0.18, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'cliff-wolf': {
    id: 'cliff-wolf',
    name: 'Cliff Wolf',
    family: 'cliffDwellers',
    tier: 'regular',
    isBoss: false,
    weaknessDamageType: 'physical',
    vulnerableAilments: ['stun', 'poison', 'blind'],
    stats: { maxHp: 30, attack: 8, defense: 4, speed: 10 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'ridge-ambush', weight: 2 },
    ],
    xpReward: 13,
    goldReward: 7,
    lootTable: [
      { itemId: 'wolf-fang', chance: 0.4, minQuantity: 1, maxQuantity: 2 },
      // ridge-ambush inflicts Silence - echo-herb cures it.
      { itemId: 'echo-herb', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'ridge-hawk': {
    id: 'ridge-hawk',
    name: 'Ridge Hawk',
    family: 'cliffDwellers',
    tier: 'elite',
    isBoss: false,
    weaknessDamageType: 'physical',
    vulnerableAilments: ['stun', 'poison', 'blind'],
    stats: { maxHp: 44, attack: 11, defense: 6, speed: 12 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'ridge-ambush', weight: 3 },
    ],
    xpReward: 21,
    goldReward: 12,
    lootTable: [
      { itemId: 'wolf-fang', chance: 0.5, minQuantity: 1, maxQuantity: 3 },
      { itemId: 'echo-herb', chance: 0.18, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'pool-wisp': {
    id: 'pool-wisp',
    name: 'Pool Wisp',
    family: 'waterSpirits',
    tier: 'regular',
    isBoss: false,
    weaknessDamageType: 'lantern',
    vulnerableAilments: ['burn', 'poison', 'blind'],
    stats: { maxHp: 29, attack: 7, defense: 4, speed: 9 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'wisp-chill', weight: 2 },
    ],
    xpReward: 14,
    goldReward: 8,
    lootTable: [
      { itemId: 'silver-droplet', chance: 0.4, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'spirit-draught', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      // wisp-chill inflicts Freeze - thaw-crystal cures it.
      { itemId: 'thaw-crystal', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'falls-siren': {
    id: 'falls-siren',
    name: 'Falls Siren',
    family: 'waterSpirits',
    tier: 'elite',
    isBoss: false,
    weaknessDamageType: 'lantern',
    vulnerableAilments: ['burn', 'poison', 'blind'],
    stats: { maxHp: 45, attack: 10, defense: 6, speed: 11 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'wisp-chill', weight: 3 },
    ],
    xpReward: 22,
    goldReward: 13,
    lootTable: [
      { itemId: 'silver-droplet', chance: 0.5, minQuantity: 1, maxQuantity: 3 },
      { itemId: 'spirit-draught', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'thaw-crystal', chance: 0.18, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'briar-wraith': {
    id: 'briar-wraith',
    name: 'Briar Wraith',
    family: 'briarSpirits',
    tier: 'regular',
    isBoss: false,
    weaknessDamageType: 'spirit',
    vulnerableAilments: ['burn', 'freeze', 'silence'],
    stats: { maxHp: 32, attack: 9, defense: 5, speed: 7 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'briar-thorn-lash', weight: 2 },
    ],
    xpReward: 16,
    goldReward: 9,
    lootTable: [
      { itemId: 'withered-bramble', chance: 0.4, minQuantity: 1, maxQuantity: 2 },
      // briar-thorn-lash inflicts Poison - antidote cures it.
      { itemId: 'antidote', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'cemetery-shade': {
    id: 'cemetery-shade',
    name: 'Cemetery Shade',
    family: 'briarSpirits',
    tier: 'elite',
    isBoss: false,
    weaknessDamageType: 'spirit',
    vulnerableAilments: ['burn', 'freeze', 'silence'],
    stats: { maxHp: 48, attack: 12, defense: 7, speed: 8 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'briar-thorn-lash', weight: 3 },
    ],
    xpReward: 24,
    goldReward: 14,
    lootTable: [
      { itemId: 'withered-bramble', chance: 0.5, minQuantity: 1, maxQuantity: 3 },
      { itemId: 'antidote', chance: 0.18, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'coalbound-warden': {
    id: 'coalbound-warden',
    name: 'The Coalbound Warden',
    family: 'boss',
    tier: 'boss',
    isBoss: true,
    weaknessDamageType: 'lantern',
    prerequisiteQuestId: 'the-shrine-below',
    // A boss stays resistant to more of the ailment kit than a regular/elite of its own family
    // would - only 2 vulnerabilities instead of 3, reflecting its tougher, more resilient nature.
    vulnerableAilments: ['freeze', 'stun'],
    stats: { maxHp: 140, attack: 13, defense: 8, speed: 8 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'warden-coal-slam', weight: 2 },
      { skillId: 'warden-warden-wrath', weight: 2, unlocksAtHpFraction: 0.5 },
    ],
    xpReward: 150,
    goldReward: 80,
    lootTable: [
      { itemId: 'wardens-ember-heart', chance: 1, minQuantity: 1, maxQuantity: 1 },
      // warden-warden-wrath inflicts Burn - a modest chance at a burn-salve alongside the
      // guaranteed trophy.
      { itemId: 'burn-salve', chance: 0.25, minQuantity: 1, maxQuantity: 2 },
    ],
  },

  // --- Crimson Bayou (MSQ Volume II) ---
  // Base stats/rewards authored a step above Iron Mountains' own late-region numbers (Briar
  // Spirits: 32/48 maxHp, 16/24 xp) since this content comes later in the story - see
  // rollEnemyLevel/scaledEnemyStats above for how level-scaling then carries that lead across the
  // whole 1-100 range regardless of authored base.
  'marsh-crocodile': {
    id: 'marsh-crocodile',
    name: 'Marsh Crocodile',
    family: 'swampCrocs',
    tier: 'regular',
    isBoss: false,
    weaknessDamageType: 'physical',
    // croc-death-roll inflicts Stun - no cure item exists for Stun (same as restless-miner's own
    // pickaxe-swing), so vulnerableAilments below deliberately excludes it too.
    vulnerableAilments: ['burn', 'poison', 'freeze'],
    stats: { maxHp: 36, attack: 10, defense: 7, speed: 7 },
    moves: [
      { skillId: 'attack', weight: 3 },
      { skillId: 'croc-death-roll', weight: 1 },
    ],
    xpReward: 18,
    goldReward: 10,
    lootTable: [{ itemId: 'croc-hide', chance: 0.4, minQuantity: 1, maxQuantity: 2 }],
  },
  'bog-ravager': {
    id: 'bog-ravager',
    name: 'Bog Ravager',
    family: 'swampCrocs',
    tier: 'elite',
    isBoss: false,
    weaknessDamageType: 'physical',
    vulnerableAilments: ['burn', 'poison', 'freeze'],
    stats: { maxHp: 54, attack: 13, defense: 9, speed: 9 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'croc-death-roll', weight: 2 },
    ],
    xpReward: 27,
    goldReward: 15,
    lootTable: [{ itemId: 'croc-hide', chance: 0.5, minQuantity: 1, maxQuantity: 3 }],
  },
  'bog-hag': {
    id: 'bog-hag',
    name: 'Bog Hag',
    family: 'bogWitches',
    tier: 'regular',
    isBoss: false,
    weaknessDamageType: 'spirit',
    vulnerableAilments: ['burn', 'freeze', 'stun'],
    stats: { maxHp: 34, attack: 10, defense: 5, speed: 9 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'hag-withering-hex', weight: 2 },
    ],
    xpReward: 19,
    goldReward: 11,
    lootTable: [
      { itemId: 'bog-ash', chance: 0.4, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'spirit-draught', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      // hag-withering-hex inflicts Poison - antidote cures it.
      { itemId: 'antidote', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'cypress-witch': {
    id: 'cypress-witch',
    name: 'Cypress Witch',
    family: 'bogWitches',
    tier: 'elite',
    isBoss: false,
    weaknessDamageType: 'spirit',
    vulnerableAilments: ['burn', 'freeze', 'stun'],
    stats: { maxHp: 52, attack: 13, defense: 7, speed: 11 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'hag-withering-hex', weight: 3 },
    ],
    xpReward: 28,
    goldReward: 16,
    lootTable: [
      { itemId: 'bog-ash', chance: 0.5, minQuantity: 1, maxQuantity: 3 },
      { itemId: 'spirit-draught', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'antidote', chance: 0.18, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'rougarou-stalker': {
    id: 'rougarou-stalker',
    name: 'Rougarou Stalker',
    family: 'rougarou',
    tier: 'regular',
    isBoss: false,
    weaknessDamageType: 'lantern',
    vulnerableAilments: ['burn', 'silence', 'stun'],
    stats: { maxHp: 37, attack: 11, defense: 6, speed: 11 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'rougarou-feral-rend', weight: 2 },
    ],
    xpReward: 20,
    goldReward: 11,
    lootTable: [
      { itemId: 'rougarou-claw', chance: 0.4, minQuantity: 1, maxQuantity: 2 },
      // rougarou-feral-rend inflicts Blind - eye-drops cures it.
      { itemId: 'eye-drops', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  'alpha-rougarou': {
    id: 'alpha-rougarou',
    name: 'Alpha Rougarou',
    family: 'rougarou',
    tier: 'elite',
    isBoss: false,
    weaknessDamageType: 'lantern',
    vulnerableAilments: ['burn', 'silence', 'stun'],
    stats: { maxHp: 56, attack: 14, defense: 8, speed: 13 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'rougarou-feral-rend', weight: 3 },
    ],
    xpReward: 29,
    goldReward: 17,
    lootTable: [
      { itemId: 'rougarou-claw', chance: 0.5, minQuantity: 1, maxQuantity: 3 },
      { itemId: 'eye-drops', chance: 0.18, minQuantity: 1, maxQuantity: 1 },
    ],
  },
  // Boss stat block for MSF-CB-009 "Guardian of the Deep". Now fully reachable as of Phase 5 - see
  // BOSS_REQUIRED_LOCATION/BOSS_REGION_LOCATIONS below and the quest's own prerequisiteQuestId.
  'ancient-serpent-guardian': {
    id: 'ancient-serpent-guardian',
    name: 'Ancient Serpent Guardian',
    family: 'boss',
    tier: 'boss',
    isBoss: true,
    weaknessDamageType: 'spirit',
    prerequisiteQuestId: 'lantern-beneath-still-waters',
    vulnerableAilments: ['freeze', 'stun'],
    stats: { maxHp: 185, attack: 16, defense: 10, speed: 10 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'serpent-guardian-coil-crush', weight: 2 },
      { skillId: 'serpent-guardian-venom-fang', weight: 2, unlocksAtHpFraction: 0.5 },
    ],
    xpReward: 200,
    goldReward: 110,
    lootTable: [
      { itemId: 'ancient-serpent-scale', chance: 1, minQuantity: 1, maxQuantity: 1 },
      // serpent-guardian-venom-fang inflicts Poison - a modest chance at an antidote alongside the
      // guaranteed trophy.
      { itemId: 'antidote', chance: 0.25, minQuantity: 1, maxQuantity: 2 },
      // Cypress Spirits family's Mythic tier (mother-cypress-totem, granted via the Mother Cypress
      // Shrine restoration quest, is this family's Legendary cap) - a real, if not guaranteed,
      // earn path for it, same "not every rare+ item needs a unique quest thread" reasoning as the
      // region's own chest loot.
      { itemId: 'cypress-guardian-totem', chance: 0.4, minQuantity: 1, maxQuantity: 1 },
    ],
  },

  // --- Endless Prairie (MSQ Volume III) ---
  // Base stats/rewards authored a step above Crimson Bayou's own (Rougarou: 37/56 maxHp, 20/29
  // xp), matching the "power creep by story position" convention used for Bayou-over-Iron-
  // Mountains above.
  'wind-wisp': {
    id: 'wind-wisp',
    name: 'Wind Wisp',
    family: 'windSpirits',
    tier: 'regular',
    isBoss: false,
    weaknessDamageType: 'spirit',
    // wisp-hush-gale inflicts Silence - excluded here (immune to what it deals out).
    vulnerableAilments: ['burn', 'freeze', 'poison'],
    stats: { maxHp: 41, attack: 12, defense: 8, speed: 12 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'wisp-hush-gale', weight: 2 },
    ],
    xpReward: 22,
    goldReward: 12,
    lootTable: [{ itemId: 'lantern-oil', chance: 0.15, minQuantity: 1, maxQuantity: 1 }],
  },
  'storm-wisp': {
    id: 'storm-wisp',
    name: 'Storm Wisp',
    family: 'windSpirits',
    tier: 'elite',
    isBoss: false,
    weaknessDamageType: 'spirit',
    vulnerableAilments: ['burn', 'freeze', 'poison'],
    stats: { maxHp: 61, attack: 15, defense: 10, speed: 15 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'wisp-hush-gale', weight: 3 },
    ],
    xpReward: 32,
    goldReward: 18,
    lootTable: [{ itemId: 'lantern-oil', chance: 0.2, minQuantity: 1, maxQuantity: 2 }],
  },
  'prairie-wolf': {
    id: 'prairie-wolf',
    name: 'Prairie Wolf',
    family: 'prairieWolves',
    tier: 'regular',
    isBoss: false,
    weaknessDamageType: 'physical',
    // wolf-pack-takedown inflicts Stun - excluded here (immune to what it deals out).
    vulnerableAilments: ['burn', 'poison', 'blind'],
    stats: { maxHp: 42, attack: 13, defense: 7, speed: 11 },
    moves: [
      { skillId: 'attack', weight: 2 },
      { skillId: 'wolf-pack-takedown', weight: 2 },
    ],
    xpReward: 22,
    goldReward: 12,
    lootTable: [{ itemId: 'healing-poultice', chance: 0.12, minQuantity: 1, maxQuantity: 1 }],
  },
  'dire-prairie-wolf': {
    id: 'dire-prairie-wolf',
    name: 'Dire Prairie Wolf',
    family: 'prairieWolves',
    tier: 'elite',
    isBoss: false,
    weaknessDamageType: 'physical',
    vulnerableAilments: ['burn', 'poison', 'blind'],
    stats: { maxHp: 62, attack: 16, defense: 9, speed: 14 },
    moves: [
      { skillId: 'attack', weight: 1 },
      { skillId: 'wolf-pack-takedown', weight: 3 },
    ],
    xpReward: 32,
    goldReward: 18,
    lootTable: [{ itemId: 'healing-poultice', chance: 0.18, minQuantity: 1, maxQuantity: 2 }],
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
  'murkwater-trails': [
    { enemyId: 'marsh-crocodile', weight: 3 },
    { enemyId: 'bog-ravager', weight: 1 },
  ],
  'cypress-marsh': [
    { enemyId: 'bog-hag', weight: 3 },
    { enemyId: 'cypress-witch', weight: 1 },
  ],
  'hidden-river-landing': [
    { enemyId: 'rougarou-stalker', weight: 3 },
    { enemyId: 'alpha-rougarou', weight: 1 },
  ],
  // Temple of the Deep Current (Chapter 4 dungeon) - the region's toughest regular/elite mix,
  // drawn from all 3 Chapter 3 families rather than introducing a dungeon-exclusive one, matching
  // Hollow Rail Mine's own precedent of drawing from more than one family within a single dungeon.
  'temple-of-the-deep-current': [
    { enemyId: 'bog-ravager', weight: 2 },
    { enemyId: 'cypress-witch', weight: 2 },
    { enemyId: 'alpha-rougarou', weight: 2 },
  ],
  // Endless Prairie (MSQ Volume III, Chapter 5) - matches each field map's encounterTable in
  // src/data/locations.ts exactly.
  'golden-prairie': [
    { enemyId: 'prairie-wolf', weight: 3 },
    { enemyId: 'dire-prairie-wolf', weight: 1 },
  ],
  'spirit-herd-plains': [
    { enemyId: 'prairie-wolf', weight: 2 },
    { enemyId: 'wind-wisp', weight: 2 },
  ],
  'sacred-hills': [
    { enemyId: 'wind-wisp', weight: 3 },
    { enemyId: 'storm-wisp', weight: 1 },
  ],
  'stone-circle-valley': [
    { enemyId: 'wind-wisp', weight: 2 },
    { enemyId: 'storm-wisp', weight: 2 },
  ],
  'thunderbird-mesa-approach': [
    { enemyId: 'storm-wisp', weight: 2 },
    { enemyId: 'dire-prairie-wolf', weight: 2 },
  ],
};

/** Which locations a boss's optional "adds" (0-3 additional enemies that can join the fight) may
 *  be drawn from - the boss's own region. Includes the boss's own home location, since its own
 *  trash mobs are a legitimate add source too. Bosses must never appear in ENCOUNTER_TABLES
 *  themselves (adds are drawn from those tables, and a boss showing up as an "add" would be a
 *  content-authoring bug), so no filtering for that case is needed here. */
export const BOSS_REGION_LOCATIONS: Record<string, string[]> = {
  'coalbound-warden': ['ironwood-trail', 'raven-ridge', 'whisper-falls', 'black-briar-forest', 'hollow-rail-mine'],
  'ancient-serpent-guardian': [
    'cypress-marsh',
    'murkwater-trails',
    'hidden-river-landing',
    'temple-of-the-deep-current',
  ],
};
