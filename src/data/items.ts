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
    tier: 'common',
  },
  {
    id: 'greater-healing-poultice',
    name: 'Greater Healing Poultice',
    description: 'A stronger brew, harder to come by - restores considerably more HP than the common poultice.',
    category: 'consumable',
    iconAssetId: 'icon.item.healing-poultice',
    effect: { healHp: 55 },
    stackable: true,
    tier: 'uncommon',
  },
  {
    id: 'spirit-draught',
    name: 'Spirit Draught',
    description: 'Bottled starlight and creekwater. Restores a modest amount of Spirit.',
    category: 'consumable',
    iconAssetId: 'icon.item.spirit-draught',
    effect: { healSpirit: 20 },
    stackable: true,
    tier: 'common',
  },
  {
    id: 'lantern-oil',
    name: 'Lantern Oil',
    description: "Refined oil for a Keeper's lantern - refills the Oil its ability draws on. Usable in or out of battle.",
    category: 'consumable',
    iconAssetId: 'icon.item.lantern-oil',
    effect: { restoreOil: 15 },
    stackable: true,
    tier: 'uncommon',
  },
  {
    id: 'moth-dust',
    name: 'Moth Dust',
    description: 'Fine silver dust shed from a Mothling\'s wings. A curious keepsake.',
    category: 'keyItem',
    iconAssetId: 'icon.item.moth-dust',
    stackable: true,
    tier: 'common',
  },
  {
    id: 'rusted-token',
    name: 'Rusted Token',
    description: 'A mine-shift token, decades overdue.',
    category: 'keyItem',
    iconAssetId: 'icon.item.rusted-token',
    stackable: true,
    tier: 'common',
  },
  {
    id: 'ember-shard',
    name: 'Ember Shard',
    description: 'A cooled fragment of coal-spirit fire, still faintly warm.',
    category: 'keyItem',
    iconAssetId: 'icon.item.ember-shard',
    stackable: true,
    tier: 'uncommon',
  },
  {
    id: 'wolf-fang',
    name: 'Wolf Fang',
    description: 'A curved fang from a cliff wolf, still sharp.',
    category: 'keyItem',
    iconAssetId: 'icon.item.wolf-fang',
    stackable: true,
    tier: 'common',
  },
  {
    id: 'silver-droplet',
    name: 'Silver Droplet',
    description: 'A bead of water from Whisper Falls that never quite dries.',
    category: 'keyItem',
    iconAssetId: 'icon.item.silver-droplet',
    stackable: true,
    tier: 'common',
  },
  {
    id: 'withered-bramble',
    name: 'Withered Bramble',
    description: 'A twist of thorned bramble from Black Briar Forest, cold to the touch.',
    category: 'keyItem',
    iconAssetId: 'icon.item.withered-bramble',
    stackable: true,
    tier: 'common',
  },
  {
    id: 'miners-lost-lantern',
    name: "The Miner's Lost Lantern",
    description: 'A battered lantern relic, lost deep in Hollow Rail Mine. Recovering it is a quest unto itself.',
    category: 'keyItem',
    iconAssetId: 'icon.item.miners-lost-lantern',
    stackable: false,
    tier: 'rare',
    unique: true,
  },
  {
    id: 'wardens-ember-heart',
    name: "Warden's Ember Heart",
    description: 'The smoldering core of the Coalbound Warden, still warm long after the fight ends.',
    category: 'keyItem',
    iconAssetId: 'icon.item.wardens-ember-heart',
    stackable: false,
    tier: 'legendary',
    unique: true,
  },
];

// Display copy only — functions/src/data/prices.ts is authoritative for purchaseItem.
export const SHOP_LISTINGS: ShopListing[] = [
  { itemId: 'healing-poultice', price: 15, currency: 'gold' },
  { itemId: 'greater-healing-poultice', price: 45, currency: 'gold' },
  { itemId: 'spirit-draught', price: 18, currency: 'gold' },
  { itemId: 'lantern-oil', price: 20, currency: 'gold' },
  { itemId: 'keepers-lantern', price: 8, currency: 'gold' },
  // Common-tier equipment only, per the canonical rarity progression - Uncommon/Rare gear comes
  // from chests instead; no totem is sold here, Spirit Totems start at Rare in this design.
  { itemId: 'weathered-walking-staff', price: 30, currency: 'gold' },
  { itemId: 'worn-keeper-coat', price: 30, currency: 'gold' },
  { itemId: 'traveler-boots', price: 25, currency: 'gold' },
  { itemId: 'work-gloves', price: 20, currency: 'gold' },
  { itemId: 'river-stone-charm', price: 25, currency: 'gold' },
];

// Display-only grouping of SHOP_LISTINGS by which NPC/building sells it - purchaseItem.ts itself
// doesn't care which shop UI a purchase came through (it only validates itemId + price against
// SHOP_PRICES, and no item is sold by two shops), so this split is purely for the Shop screen.
export const SHOP_TITLES: Record<string, string> = {
  'mara-vale-general-store': "Mara Vale's General Store",
  'blacksmith-forge': 'The Ash Hallow Forge',
  apothecary: "Wren's Apothecary",
};

export const SHOP_CATALOGS: Record<string, string[]> = {
  'mara-vale-general-store': ['keepers-lantern', 'river-stone-charm'],
  'blacksmith-forge': ['weathered-walking-staff', 'worn-keeper-coat', 'traveler-boots', 'work-gloves'],
  apothecary: ['healing-poultice', 'greater-healing-poultice', 'spirit-draught', 'lantern-oil'],
};

export const INN_REST_COST = 10;
