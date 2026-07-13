// Authoritative — the client's src/data/recipes.ts is a display copy only.

export interface RecipeMaterial {
  itemId: string;
  quantity: number;
}

export interface Recipe {
  outputItemId: string;
  materials: RecipeMaterial[];
}

/** Crafting recipes for the replenishment-potion ladder (common/uncommon/rare/mythic, see
 *  data/items.ts) and the 5 ailment cures (always common - stun has none, it auto-expires and was
 *  never meant to be curable). Each recipe uses a single "themed" material tied to the enemy
 *  family whose signature move the output either restores from or cures (see enemies.ts's
 *  ailmentsInflicted mapping for the cure pairings) - the first real use these 6 enemy-drop
 *  materials have had since they were introduced. Higher tiers scale up in quantity and mix in the
 *  rarer ember-shard, giving crafting a real cost curve instead of a flat material tax. */
export const RECIPES: Record<string, Recipe> = {
  // Ailment cures - one themed material, matching the enemy family that inflicts that ailment.
  antidote: { outputItemId: 'antidote', materials: [{ itemId: 'withered-bramble', quantity: 2 }] },
  'burn-salve': { outputItemId: 'burn-salve', materials: [{ itemId: 'ember-shard', quantity: 2 }] },
  'thaw-crystal': { outputItemId: 'thaw-crystal', materials: [{ itemId: 'silver-droplet', quantity: 2 }] },
  'eye-drops': { outputItemId: 'eye-drops', materials: [{ itemId: 'moth-dust', quantity: 2 }] },
  'echo-herb': { outputItemId: 'echo-herb', materials: [{ itemId: 'wolf-fang', quantity: 2 }] },

  // HP line - moth-dust base, ember-shard mixed in at uncommon and above.
  'healing-poultice': { outputItemId: 'healing-poultice', materials: [{ itemId: 'moth-dust', quantity: 2 }] },
  'greater-healing-poultice': {
    outputItemId: 'greater-healing-poultice',
    materials: [
      { itemId: 'moth-dust', quantity: 3 },
      { itemId: 'ember-shard', quantity: 1 },
    ],
  },
  'superior-healing-poultice': {
    outputItemId: 'superior-healing-poultice',
    materials: [
      { itemId: 'moth-dust', quantity: 5 },
      { itemId: 'ember-shard', quantity: 2 },
    ],
  },
  'pristine-healing-poultice': {
    outputItemId: 'pristine-healing-poultice',
    materials: [
      { itemId: 'moth-dust', quantity: 8 },
      { itemId: 'ember-shard', quantity: 4 },
    ],
  },

  // Spirit line - silver-droplet base ("bottled starlight and creekwater"), ember-shard at
  // uncommon and above.
  'spirit-draught': { outputItemId: 'spirit-draught', materials: [{ itemId: 'silver-droplet', quantity: 2 }] },
  'greater-spirit-draught': {
    outputItemId: 'greater-spirit-draught',
    materials: [
      { itemId: 'silver-droplet', quantity: 3 },
      { itemId: 'ember-shard', quantity: 1 },
    ],
  },
  'superior-spirit-draught': {
    outputItemId: 'superior-spirit-draught',
    materials: [
      { itemId: 'silver-droplet', quantity: 5 },
      { itemId: 'ember-shard', quantity: 2 },
    ],
  },
  'pristine-spirit-draught': {
    outputItemId: 'pristine-spirit-draught',
    materials: [
      { itemId: 'silver-droplet', quantity: 8 },
      { itemId: 'ember-shard', quantity: 4 },
    ],
  },

  // Lantern Oil line - rusted-token base (mine/coal theme), ember-shard at uncommon and above.
  'thin-lantern-oil': { outputItemId: 'thin-lantern-oil', materials: [{ itemId: 'rusted-token', quantity: 2 }] },
  'lantern-oil': {
    outputItemId: 'lantern-oil',
    materials: [
      { itemId: 'rusted-token', quantity: 3 },
      { itemId: 'ember-shard', quantity: 1 },
    ],
  },
  'superior-lantern-oil': {
    outputItemId: 'superior-lantern-oil',
    materials: [
      { itemId: 'rusted-token', quantity: 5 },
      { itemId: 'ember-shard', quantity: 2 },
    ],
  },
  'pristine-lantern-oil': {
    outputItemId: 'pristine-lantern-oil',
    materials: [
      { itemId: 'rusted-token', quantity: 8 },
      { itemId: 'ember-shard', quantity: 4 },
    ],
  },
};
