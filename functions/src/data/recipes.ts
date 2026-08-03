// Authoritative — the client's src/data/recipes.ts is a display copy only.

export interface RecipeMaterial {
  /** Any of these item ids count toward this slot's `quantity`, summed across whichever ones the
   *  player actually has - lets a newer region's thematically-equivalent material substitute for
   *  an older one (e.g. bog-ash standing in for withered-bramble in the antidote recipe) without
   *  ever changing what a recipe actually costs. The first id is the original/primary material;
   *  later ids are alternates added as new regions ship. Consumed in listed order (primary first)
   *  so existing behavior is unchanged for anyone who only ever has the primary material. */
  itemIds: string[];
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
// Alternate-material pools, kept as named constants so a future region only needs to add its own
// thematic material to the relevant pool here rather than editing every recipe that uses it.
// Pairing logic: an alternate is added only where a real thematic fit exists (the enemy family
// that drops it shares the same ailment/flavor role as the pool's original material) - not every
// pool needs an alternate from every region, and a material with no natural fit anywhere is still
// a perfectly valid item on its own (sellable, or reserved for a future recipe).
const WITHERED_BRAMBLE_OR = ['withered-bramble', 'bog-ash']; // both inflict/cure Poison (hag-withering-hex)
const MOTH_DUST_OR = ['moth-dust']; // no Bayou material shares moth-dust's HP-restoring role
const MOTH_DUST_OR_EYE_DROPS = ['moth-dust', 'rougarou-claw']; // both tied to Blind (rougarou-feral-rend)
const SILVER_DROPLET_OR = ['silver-droplet']; // no Bayou material shares this one's Freeze/Spirit role
const EMBER_SHARD_OR = ['ember-shard', 'ancient-serpent-scale']; // both a rare "precious ingredient" role, not tied to one ailment

export const RECIPES: Record<string, Recipe> = {
  // Ailment cures - one themed material (now possibly one of several, see the pools above),
  // matching the enemy family that inflicts that ailment.
  antidote: { outputItemId: 'antidote', materials: [{ itemIds: WITHERED_BRAMBLE_OR, quantity: 2 }] },
  'burn-salve': { outputItemId: 'burn-salve', materials: [{ itemIds: EMBER_SHARD_OR, quantity: 2 }] },
  'thaw-crystal': { outputItemId: 'thaw-crystal', materials: [{ itemIds: SILVER_DROPLET_OR, quantity: 2 }] },
  'eye-drops': { outputItemId: 'eye-drops', materials: [{ itemIds: MOTH_DUST_OR_EYE_DROPS, quantity: 2 }] },
  'echo-herb': { outputItemId: 'echo-herb', materials: [{ itemIds: ['wolf-fang'], quantity: 2 }] },

  // HP line - moth-dust base, ember-shard (or its alternates) mixed in at uncommon and above.
  'healing-poultice': { outputItemId: 'healing-poultice', materials: [{ itemIds: MOTH_DUST_OR, quantity: 2 }] },
  'greater-healing-poultice': {
    outputItemId: 'greater-healing-poultice',
    materials: [
      { itemIds: MOTH_DUST_OR, quantity: 3 },
      { itemIds: EMBER_SHARD_OR, quantity: 1 },
    ],
  },
  'superior-healing-poultice': {
    outputItemId: 'superior-healing-poultice',
    materials: [
      { itemIds: MOTH_DUST_OR, quantity: 5 },
      { itemIds: EMBER_SHARD_OR, quantity: 2 },
    ],
  },
  'pristine-healing-poultice': {
    outputItemId: 'pristine-healing-poultice',
    materials: [
      { itemIds: MOTH_DUST_OR, quantity: 8 },
      { itemIds: EMBER_SHARD_OR, quantity: 4 },
    ],
  },

  // Spirit line - silver-droplet base ("bottled starlight and creekwater"), ember-shard (or its
  // alternates) at uncommon and above.
  'spirit-draught': { outputItemId: 'spirit-draught', materials: [{ itemIds: SILVER_DROPLET_OR, quantity: 2 }] },
  'greater-spirit-draught': {
    outputItemId: 'greater-spirit-draught',
    materials: [
      { itemIds: SILVER_DROPLET_OR, quantity: 3 },
      { itemIds: EMBER_SHARD_OR, quantity: 1 },
    ],
  },
  'superior-spirit-draught': {
    outputItemId: 'superior-spirit-draught',
    materials: [
      { itemIds: SILVER_DROPLET_OR, quantity: 5 },
      { itemIds: EMBER_SHARD_OR, quantity: 2 },
    ],
  },
  'pristine-spirit-draught': {
    outputItemId: 'pristine-spirit-draught',
    materials: [
      { itemIds: SILVER_DROPLET_OR, quantity: 8 },
      { itemIds: EMBER_SHARD_OR, quantity: 4 },
    ],
  },

  // Lantern Oil line - rusted-token base (mine/coal theme), ember-shard (or its alternates) at
  // uncommon and above.
  'thin-lantern-oil': { outputItemId: 'thin-lantern-oil', materials: [{ itemIds: ['rusted-token'], quantity: 2 }] },
  'lantern-oil': {
    outputItemId: 'lantern-oil',
    materials: [
      { itemIds: ['rusted-token'], quantity: 3 },
      { itemIds: EMBER_SHARD_OR, quantity: 1 },
    ],
  },
  'superior-lantern-oil': {
    outputItemId: 'superior-lantern-oil',
    materials: [
      { itemIds: ['rusted-token'], quantity: 5 },
      { itemIds: EMBER_SHARD_OR, quantity: 2 },
    ],
  },
  'pristine-lantern-oil': {
    outputItemId: 'pristine-lantern-oil',
    materials: [
      { itemIds: ['rusted-token'], quantity: 8 },
      { itemIds: EMBER_SHARD_OR, quantity: 4 },
    ],
  },
};
