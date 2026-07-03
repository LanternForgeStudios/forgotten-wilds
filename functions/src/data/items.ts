// Authoritative — the client's src/data/items.ts is a display copy only.

export interface ItemEffect {
  healHp?: number;
  healSpirit?: number;
}

export interface ItemDefinition {
  id: string;
  category: 'consumable' | 'equipment' | 'keyItem' | 'lanternUpgrade';
  usableInCombat: boolean;
  effect?: ItemEffect;
}

export const ITEMS: Record<string, ItemDefinition> = {
  'healing-poultice': { id: 'healing-poultice', category: 'consumable', usableInCombat: true, effect: { healHp: 30 } },
  'spirit-draught': { id: 'spirit-draught', category: 'consumable', usableInCombat: true, effect: { healSpirit: 20 } },
  'lantern-oil': { id: 'lantern-oil', category: 'lanternUpgrade', usableInCombat: false },
  'moth-dust': { id: 'moth-dust', category: 'keyItem', usableInCombat: false },
  'rusted-token': { id: 'rusted-token', category: 'keyItem', usableInCombat: false },
  'ember-shard': { id: 'ember-shard', category: 'keyItem', usableInCombat: false },
  'miners-lost-lantern': { id: 'miners-lost-lantern', category: 'keyItem', usableInCombat: false },
  'wardens-ember-heart': { id: 'wardens-ember-heart', category: 'keyItem', usableInCombat: false },
};

export const SHOP_PRICES: Record<string, number> = {
  'healing-poultice': 15,
  'spirit-draught': 18,
  'lantern-oil': 40,
};

export const INN_REST_COST = 10;
