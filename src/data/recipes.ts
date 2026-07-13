import type { Recipe } from '@/types';

// Display copy only — functions/src/data/recipes.ts is the authoritative source used by craftItem.
export const RECIPES: Record<string, Recipe> = {
  antidote: { outputItemId: 'antidote', materials: [{ itemId: 'withered-bramble', quantity: 2 }] },
  'burn-salve': { outputItemId: 'burn-salve', materials: [{ itemId: 'ember-shard', quantity: 2 }] },
  'thaw-crystal': { outputItemId: 'thaw-crystal', materials: [{ itemId: 'silver-droplet', quantity: 2 }] },
  'eye-drops': { outputItemId: 'eye-drops', materials: [{ itemId: 'moth-dust', quantity: 2 }] },
  'echo-herb': { outputItemId: 'echo-herb', materials: [{ itemId: 'wolf-fang', quantity: 2 }] },

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
