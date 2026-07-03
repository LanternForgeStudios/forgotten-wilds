import type { Item, ShopListing } from '@/types';

// Display copy only — functions/src/data/{items,prices}.ts are the authoritative source used server-side.
export const ITEMS: Item[] = [
  {
    id: 'healing-poultice',
    name: 'Healing Poultice',
    description: 'A folk remedy of mountain herbs. Restores a modest amount of HP.',
    category: 'consumable',
    iconAssetId: 'icon.item.healing-poultice',
    effect: { healHp: 30 },
    stackable: true,
  },
  {
    id: 'spirit-draught',
    name: 'Spirit Draught',
    description: 'Bottled starlight and creekwater. Restores a modest amount of Spirit.',
    category: 'consumable',
    iconAssetId: 'icon.item.spirit-draught',
    effect: { healSpirit: 20 },
    stackable: true,
  },
  {
    id: 'lantern-oil',
    name: 'Lantern Oil',
    description: 'Refined oil that strengthens a Keeper\'s lantern, unlocking its next upgrade tier.',
    category: 'lanternUpgrade',
    iconAssetId: 'icon.item.lantern-oil',
    stackable: true,
  },
  {
    id: 'moth-dust',
    name: 'Moth Dust',
    description: 'Fine silver dust shed from a Mothling\'s wings. A curious keepsake.',
    category: 'keyItem',
    iconAssetId: 'icon.item.moth-dust',
    stackable: true,
  },
  {
    id: 'rusted-token',
    name: 'Rusted Token',
    description: 'A mine-shift token, decades overdue.',
    category: 'keyItem',
    iconAssetId: 'icon.item.rusted-token',
    stackable: true,
  },
  {
    id: 'ember-shard',
    name: 'Ember Shard',
    description: 'A cooled fragment of coal-spirit fire, still faintly warm.',
    category: 'keyItem',
    iconAssetId: 'icon.item.ember-shard',
    stackable: true,
  },
  {
    id: 'miners-lost-lantern',
    name: "The Miner's Lost Lantern",
    description: 'A battered lantern relic, lost deep in Hollow Rail Mine. Recovering it is a quest unto itself.',
    category: 'keyItem',
    iconAssetId: 'icon.item.miners-lost-lantern',
    stackable: false,
  },
  {
    id: 'wardens-ember-heart',
    name: "Warden's Ember Heart",
    description: 'The smoldering core of the Coalbound Warden, still warm long after the fight ends.',
    category: 'keyItem',
    iconAssetId: 'icon.item.wardens-ember-heart',
    stackable: false,
  },
];

// Display copy only — functions/src/data/prices.ts is authoritative for purchaseItem.
export const SHOP_LISTINGS: ShopListing[] = [
  { itemId: 'healing-poultice', price: 15, currency: 'gold' },
  { itemId: 'spirit-draught', price: 18, currency: 'gold' },
  { itemId: 'lantern-oil', price: 40, currency: 'gold' },
  { itemId: 'keepers-lantern', price: 8, currency: 'gold' },
];

export const INN_REST_COST = 10;
