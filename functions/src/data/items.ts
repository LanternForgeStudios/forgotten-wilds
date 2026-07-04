// Authoritative — the client's src/data/items.ts is a display copy only.

export type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface ItemEffect {
  healHp?: number;
  healSpirit?: number;
  /** Refills the equipped lantern's Oil, clamped to its capacity. */
  restoreOil?: number;
}

export interface ItemDefinition {
  id: string;
  category: 'consumable' | 'equipment' | 'keyItem' | 'lanternUpgrade';
  usableInCombat: boolean;
  effect?: ItemEffect;
  tier: Tier;
  /** Caps ownership at 1 and blocks a second copy from ever being granted - for milestone-only
   *  trophies/relics, not shop stock. */
  unique?: boolean;
}

export const ITEMS: Record<string, ItemDefinition> = {
  'healing-poultice': {
    id: 'healing-poultice',
    category: 'consumable',
    usableInCombat: true,
    effect: { healHp: 30 },
    tier: 'common',
  },
  'greater-healing-poultice': {
    id: 'greater-healing-poultice',
    category: 'consumable',
    usableInCombat: true,
    effect: { healHp: 55 },
    tier: 'uncommon',
  },
  'spirit-draught': {
    id: 'spirit-draught',
    category: 'consumable',
    usableInCombat: true,
    effect: { healSpirit: 20 },
    tier: 'common',
  },
  'lantern-oil': {
    id: 'lantern-oil',
    category: 'consumable',
    usableInCombat: true,
    effect: { restoreOil: 15 },
    tier: 'uncommon',
  },
  'moth-dust': { id: 'moth-dust', category: 'keyItem', usableInCombat: false, tier: 'common' },
  'rusted-token': { id: 'rusted-token', category: 'keyItem', usableInCombat: false, tier: 'common' },
  'ember-shard': { id: 'ember-shard', category: 'keyItem', usableInCombat: false, tier: 'uncommon' },
  'miners-lost-lantern': {
    id: 'miners-lost-lantern',
    category: 'keyItem',
    usableInCombat: false,
    tier: 'rare',
    unique: true,
  },
  'wardens-ember-heart': {
    id: 'wardens-ember-heart',
    category: 'keyItem',
    usableInCombat: false,
    tier: 'legendary',
    unique: true,
  },
};

export const SHOP_PRICES: Record<string, number> = {
  'healing-poultice': 15,
  'greater-healing-poultice': 45,
  'spirit-draught': 18,
  'lantern-oil': 20,
  // A spare standard-issue lantern - cheap safety net for anyone who unequips their only one.
  'keepers-lantern': 8,
  // Common-tier equipment - Mara stocks one of each slot's basic gear. Uncommon-tier gear is
  // deliberately not sold here; it comes from chests and quest rewards instead.
  'miners-pick': 30,
  'travelers-coat': 30,
  'worn-trail-boots': 25,
  'frayed-gloves': 20,
  'ash-hallow-token': 25,
  'carved-totem': 20,
};

export const INN_REST_COST = 10;
