import type { Recipe } from '@/types';

// Display copy only — functions/src/data/recipes.ts is the authoritative source used by craftItem.

// Alternate-material pools - kept in sync by hand with the identical constants in
// functions/src/data/recipes.ts (see that file's own comment for the pairing rationale).
const WITHERED_BRAMBLE_OR = ['withered-bramble', 'bog-ash', 'withered-echo-moss'];
const MOTH_DUST_OR = ['moth-dust'];
const MOTH_DUST_OR_EYE_DROPS = ['moth-dust', 'rougarou-claw'];
const SILVER_DROPLET_OR = ['silver-droplet'];
const EMBER_SHARD_OR = ['ember-shard', 'ancient-serpent-scale'];
const WOLF_FANG_OR = ['wolf-fang', 'wisp-feather'];

export const RECIPES: Record<string, Recipe> = {
  antidote: { outputItemId: 'antidote', materials: [{ itemIds: WITHERED_BRAMBLE_OR, quantity: 2 }] },
  'burn-salve': { outputItemId: 'burn-salve', materials: [{ itemIds: EMBER_SHARD_OR, quantity: 2 }] },
  'thaw-crystal': { outputItemId: 'thaw-crystal', materials: [{ itemIds: SILVER_DROPLET_OR, quantity: 2 }] },
  'eye-drops': { outputItemId: 'eye-drops', materials: [{ itemIds: MOTH_DUST_OR_EYE_DROPS, quantity: 2 }] },
  'echo-herb': { outputItemId: 'echo-herb', materials: [{ itemIds: WOLF_FANG_OR, quantity: 2 }] },

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
