import type { Item, ShopListing } from '@/types';

// Display copy only — functions/src/data/{items,prices}.ts are the authoritative source used server-side.
export const ITEMS: Item[] = [
  {
    id: 'healing-poultice',
    name: 'Healing Poultice',
    description: 'A folk remedy of mountain herbs. Restores a modest amount of HP.',
    category: 'consumable',
    iconAssetId: 'icon.item.healing-poultice',
    effect: { healHpPercent: 0.3 },
    stackable: true,
    tier: 'common',
  },
  {
    id: 'greater-healing-poultice',
    name: 'Greater Healing Poultice',
    description: 'A stronger brew, harder to come by - restores considerably more HP than the common poultice.',
    category: 'consumable',
    iconAssetId: 'icon.item.healing-poultice',
    effect: { healHpPercent: 0.6 },
    stackable: true,
    tier: 'uncommon',
  },
  {
    id: 'spirit-draught',
    name: 'Spirit Draught',
    description: 'Bottled starlight and creekwater. Restores a modest amount of Spirit.',
    category: 'consumable',
    iconAssetId: 'icon.item.spirit-draught',
    effect: { healSpiritPercent: 0.3 },
    stackable: true,
    tier: 'common',
  },
  {
    id: 'lantern-oil',
    name: 'Lantern Oil',
    description: "Refined oil for a Keeper's lantern - refills the Oil its ability draws on. Usable in or out of battle.",
    category: 'consumable',
    iconAssetId: 'icon.item.lantern-oil',
    effect: { restoreOilPercent: 0.5 },
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
    id: 'stone-fragment',
    name: 'Stone Fragment',
    description: "A shard of pale stone from Mossy Creek, faintly warm. Part of the Spirit Grove's Guardian Sigil.",
    category: 'keyItem',
    iconAssetId: 'icon.item.stone-fragment',
    stackable: false,
    tier: 'rare',
    unique: true,
  },
  {
    id: 'water-fragment',
    name: 'Water Fragment',
    description: "A bead of ever-flowing water from Whisper Falls. Part of the Spirit Grove's Guardian Sigil.",
    category: 'keyItem',
    iconAssetId: 'icon.item.water-fragment',
    stackable: false,
    tier: 'rare',
    unique: true,
  },
  {
    id: 'wind-fragment',
    name: 'Wind Fragment',
    description: "A wisp of captured wind from the Fallen Watchtower. Part of the Spirit Grove's Guardian Sigil.",
    category: 'keyItem',
    iconAssetId: 'icon.item.wind-fragment',
    stackable: false,
    tier: 'rare',
    unique: true,
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
  {
    id: 'guardian-memory-fragment-1',
    name: 'Guardian Memory Fragment I',
    description: "A fragment of Old Stone Bear's memory: the Guardians did not abandon Mytherra - they were silenced.",
    category: 'keyItem',
    iconAssetId: 'icon.item.guardian-memory-fragment-1',
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
  // from chests instead. Split with no overlap between the two Ash Hallow gear shops: Blacksmith
  // stocks Weapon/Charm/Spirit Totem (no totem currently at common tier), Armory stocks
  // Armor/Boots/Gloves.
  { itemId: 'weathered-walking-staff', price: 30, currency: 'gold' },
  { itemId: 'river-stone-charm', price: 25, currency: 'gold' },
  { itemId: 'worn-keeper-coat', price: 30, currency: 'gold' },
  { itemId: 'traveler-boots', price: 25, currency: 'gold' },
  { itemId: 'work-gloves', price: 20, currency: 'gold' },
];

// Display-only grouping of SHOP_LISTINGS by which NPC/building sells it - purchaseItem.ts itself
// doesn't care which shop UI a purchase came through (it only validates itemId + price against
// SHOP_PRICES, and no item is sold by two shops), so this split is purely for the Shop screen.
export const SHOP_TITLES: Record<string, string> = {
  'mara-ash-general-store': "Mara Ash's General Store",
  'ash-hallow-blacksmith-forge': 'The Ash Hallow Forge',
  'ash-hallow-armory': 'The Ash Hallow Armory',
  apothecary: "Willow's Apothecary",
};

export const SHOP_CATALOGS: Record<string, string[]> = {
  'mara-ash-general-store': ['keepers-lantern'],
  'ash-hallow-blacksmith-forge': ['weathered-walking-staff', 'river-stone-charm'],
  'ash-hallow-armory': ['worn-keeper-coat', 'traveler-boots', 'work-gloves'],
  apothecary: ['healing-poultice', 'greater-healing-poultice', 'spirit-draught', 'lantern-oil'],
};

export const INN_REST_COST = 10;
