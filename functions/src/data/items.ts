// Authoritative — the client's src/data/items.ts is a display copy only.

// Ascending order: Common < Uncommon < Rare < Mythic < Legendary. Per the canonical equipment
// design (docs/Mytherra-Equipment_breakdown.md) - Legendary is a named, story-tied artifact that
// ends its equipment family, ranked above Mythic.
export type Tier = 'common' | 'uncommon' | 'rare' | 'mythic' | 'legendary';

export interface ItemEffect {
  /** Fraction (0-1) of the player's current maxHp to restore - percentage rather than a flat
   *  amount so a potion stays proportionally useful as maxHp grows with level, instead of a fixed
   *  30 HP going from "half your health bar" at level 1 to "a rounding error" at level 100. */
  healHpPercent?: number;
  /** Same as healHpPercent, for Spirit. */
  healSpiritPercent?: number;
  /** Fraction (0-1) of the equipped lantern's maxLanternOil to restore - percentage rather than a
   *  flat amount so the same item stays useful whether the player is on the 30-oil starter lantern
   *  or a higher-capacity one found later. */
  restoreOilPercent?: number;
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
    effect: { healHpPercent: 0.3 },
    tier: 'common',
  },
  'greater-healing-poultice': {
    id: 'greater-healing-poultice',
    category: 'consumable',
    usableInCombat: true,
    effect: { healHpPercent: 0.6 },
    tier: 'uncommon',
  },
  'spirit-draught': {
    id: 'spirit-draught',
    category: 'consumable',
    usableInCombat: true,
    effect: { healSpiritPercent: 0.3 },
    tier: 'common',
  },
  'lantern-oil': {
    id: 'lantern-oil',
    category: 'consumable',
    usableInCombat: true,
    effect: { restoreOilPercent: 0.5 },
    tier: 'uncommon',
  },
  'moth-dust': { id: 'moth-dust', category: 'keyItem', usableInCombat: false, tier: 'common' },
  'rusted-token': { id: 'rusted-token', category: 'keyItem', usableInCombat: false, tier: 'common' },
  'ember-shard': { id: 'ember-shard', category: 'keyItem', usableInCombat: false, tier: 'uncommon' },
  'wolf-fang': { id: 'wolf-fang', category: 'keyItem', usableInCombat: false, tier: 'common' },
  'silver-droplet': { id: 'silver-droplet', category: 'keyItem', usableInCombat: false, tier: 'common' },
  'withered-bramble': { id: 'withered-bramble', category: 'keyItem', usableInCombat: false, tier: 'common' },
  'stone-fragment': { id: 'stone-fragment', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  'water-fragment': { id: 'water-fragment', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  'wind-fragment': { id: 'wind-fragment', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
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
  'guardian-memory-fragment-1': {
    id: 'guardian-memory-fragment-1',
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
  // Common-tier equipment only, per the canonical rarity progression (Common: "merchants, enemy
  // drops, common chests"). Uncommon/Rare gear comes from chests instead. Split with no overlap
  // between the two Ash Hallow gear shops: Blacksmith stocks Weapon/Charm/Spirit Totem (no totem
  // currently at common tier), Armory stocks Armor/Boots/Gloves.
  'weathered-walking-staff': 30,
  'river-stone-charm': 25,
  'worn-keeper-coat': 30,
  'traveler-boots': 25,
  'work-gloves': 20,
};

// Authoritative per-shop catalogs - purchaseItem.ts validates the requested itemId actually
// belongs to the given shopId, not just that it exists somewhere in SHOP_PRICES. Keep in sync by
// hand with src/data/items.ts's SHOP_CATALOGS (display copy).
export const SHOP_CATALOGS: Record<string, string[]> = {
  'mara-ash-general-store': ['keepers-lantern'],
  'ash-hallow-blacksmith-forge': ['weathered-walking-staff', 'river-stone-charm'],
  'ash-hallow-armory': ['worn-keeper-coat', 'traveler-boots', 'work-gloves'],
  apothecary: ['healing-poultice', 'greater-healing-poultice', 'spirit-draught', 'lantern-oil'],
};

export const INN_REST_COST = 10;
