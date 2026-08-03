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
  /** Immediately removes this ailment (see ailments.ts) if the player currently has it - a cure
   *  item with no other effect (a dedicated Antidote/Burn Salve/etc.), not something layered onto
   *  an existing healing potion. */
  cureAilmentId?: string;
}

export interface ItemDefinition {
  id: string;
  // 'materials' is for non-unique enemy-drop items with no usable effect of their own - future
  // crafting-system fodder. 'keyItem' is reserved for unique, story/quest-significant items.
  category: 'consumable' | 'equipment' | 'keyItem' | 'lanternUpgrade' | 'materials';
  usableInCombat: boolean;
  effect?: ItemEffect;
  tier: Tier;
  /** Caps ownership at 1 and blocks a second copy from ever being granted - for milestone-only
   *  trophies/relics, not shop stock. */
  unique?: boolean;
}

export const ITEMS: Record<string, ItemDefinition> = {
  // Replenishment items form a common/uncommon/rare/mythic ladder at 30/50/75/100% of the
  // relevant max stat, one line per stat (HP/Spirit/Lantern Oil) - see docs on the crafting
  // recipes (data/recipes.ts) that produce most of these. 'lantern-oil' keeps its existing id
  // (predates this ladder) even though it doesn't carry a tier-matching name prefix; every item
  // newly added here for this ladder follows greater-/superior-/pristine- for uncommon/rare/mythic.
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
    effect: { healHpPercent: 0.5 },
    tier: 'uncommon',
  },
  'superior-healing-poultice': {
    id: 'superior-healing-poultice',
    category: 'consumable',
    usableInCombat: true,
    effect: { healHpPercent: 0.75 },
    tier: 'rare',
  },
  'pristine-healing-poultice': {
    id: 'pristine-healing-poultice',
    category: 'consumable',
    usableInCombat: true,
    effect: { healHpPercent: 1 },
    tier: 'mythic',
  },
  'spirit-draught': {
    id: 'spirit-draught',
    category: 'consumable',
    usableInCombat: true,
    effect: { healSpiritPercent: 0.3 },
    tier: 'common',
  },
  'greater-spirit-draught': {
    id: 'greater-spirit-draught',
    category: 'consumable',
    usableInCombat: true,
    effect: { healSpiritPercent: 0.5 },
    tier: 'uncommon',
  },
  'superior-spirit-draught': {
    id: 'superior-spirit-draught',
    category: 'consumable',
    usableInCombat: true,
    effect: { healSpiritPercent: 0.75 },
    tier: 'rare',
  },
  'pristine-spirit-draught': {
    id: 'pristine-spirit-draught',
    category: 'consumable',
    usableInCombat: true,
    effect: { healSpiritPercent: 1 },
    tier: 'mythic',
  },
  // 'thin-lantern-oil' fills the common slot below 'lantern-oil' (already the uncommon/50% entry)
  // rather than renaming it - thematically, a thinned-down batch that burns dimmer/shorter.
  'thin-lantern-oil': {
    id: 'thin-lantern-oil',
    category: 'consumable',
    usableInCombat: true,
    effect: { restoreOilPercent: 0.3 },
    tier: 'common',
  },
  'lantern-oil': {
    id: 'lantern-oil',
    category: 'consumable',
    usableInCombat: true,
    effect: { restoreOilPercent: 0.5 },
    tier: 'uncommon',
  },
  'superior-lantern-oil': {
    id: 'superior-lantern-oil',
    category: 'consumable',
    usableInCombat: true,
    effect: { restoreOilPercent: 0.75 },
    tier: 'rare',
  },
  'pristine-lantern-oil': {
    id: 'pristine-lantern-oil',
    category: 'consumable',
    usableInCombat: true,
    effect: { restoreOilPercent: 1 },
    tier: 'mythic',
  },
  // Ailment cure items - each does nothing but clear its one matching ailment (see
  // useItem.ts/resolveCombatAction.ts's wouldHaveEffect check, which requires the player to
  // actually have that ailment before letting the item be used).
  antidote: { id: 'antidote', category: 'consumable', usableInCombat: true, effect: { cureAilmentId: 'poison' }, tier: 'common' },
  'burn-salve': { id: 'burn-salve', category: 'consumable', usableInCombat: true, effect: { cureAilmentId: 'burn' }, tier: 'common' },
  'thaw-crystal': { id: 'thaw-crystal', category: 'consumable', usableInCombat: true, effect: { cureAilmentId: 'freeze' }, tier: 'common' },
  'eye-drops': { id: 'eye-drops', category: 'consumable', usableInCombat: true, effect: { cureAilmentId: 'blind' }, tier: 'common' },
  'echo-herb': { id: 'echo-herb', category: 'consumable', usableInCombat: true, effect: { cureAilmentId: 'silence' }, tier: 'common' },
  'moth-dust': { id: 'moth-dust', category: 'materials', usableInCombat: false, tier: 'common' },
  'rusted-token': { id: 'rusted-token', category: 'materials', usableInCombat: false, tier: 'common' },
  'ember-shard': { id: 'ember-shard', category: 'materials', usableInCombat: false, tier: 'uncommon' },
  'wolf-fang': { id: 'wolf-fang', category: 'materials', usableInCombat: false, tier: 'common' },
  'silver-droplet': { id: 'silver-droplet', category: 'materials', usableInCombat: false, tier: 'common' },
  'withered-bramble': { id: 'withered-bramble', category: 'materials', usableInCombat: false, tier: 'common' },
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
  // Iron Mountains Side Quests (docs/Mytherra-SQ_breakdown.md): The Forgotten Treatises
  'frostbound-treatise': { id: 'frostbound-treatise', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  'ember-codex': { id: 'ember-codex', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  // Crimson Bayou (MSQ Volume II): the 3 Heart Seed fragments for Mother Cypress Shrine (MSF-CB-004,
  // 'seeds-of-memory') - same shape as Iron Mountains' stone/water/wind Guardian Sigil fragments.
  'heart-seed-cypress': { id: 'heart-seed-cypress', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  'heart-seed-murkwater': { id: 'heart-seed-murkwater', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  'heart-seed-river': { id: 'heart-seed-river', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  // Crimson Bayou (MSQ Volume II) enemy loot materials
  'croc-hide': { id: 'croc-hide', category: 'materials', usableInCombat: false, tier: 'common' },
  'bog-ash': { id: 'bog-ash', category: 'materials', usableInCombat: false, tier: 'common' },
  'rougarou-claw': { id: 'rougarou-claw', category: 'materials', usableInCombat: false, tier: 'uncommon' },
  'ancient-serpent-scale': {
    id: 'ancient-serpent-scale',
    category: 'keyItem',
    usableInCombat: false,
    tier: 'legendary',
    unique: true,
  },
  // Crimson Bayou (MSQ Volume II), Chapter 4: The Deep Current
  'temple-records': { id: 'temple-records', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  // The lantern as first FOUND in the Lantern Sanctuary (MSF-CB-008's collectItem target) - the
  // quest reward then grants the real equippable 'lantern-of-still-waters-equipped', same
  // found-item vs. equipped-upgrade split as Iron Mountains' miners-lost-lantern /
  // miners-lost-lantern-equipped.
  'lantern-of-still-waters': { id: 'lantern-of-still-waters', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  // Crimson Bayou's own side quest (docs/Mytherra-SQ_breakdown.md, "The Drowned Ledgers" - parallel
  // to Iron Mountains' Forgotten Treatises): 2 hidden key items, collectItem targets for
  // the-drowned-ledger/the-bogwater-almanac, each turning into a quest-taught Skill + Lore entry.
  'drowned-ledger': { id: 'drowned-ledger', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  'bogwater-almanac': { id: 'bogwater-almanac', category: 'keyItem', usableInCombat: false, tier: 'rare', unique: true },
  'guardian-memory-fragment-2': {
    id: 'guardian-memory-fragment-2',
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
  // Priced a little below healing-poultice - common, and only ever useful when the matching
  // ailment is actually active, so they shouldn't cost as much as a potion with guaranteed value.
  antidote: 12,
  'burn-salve': 12,
  'thaw-crystal': 12,
  'eye-drops': 12,
  'echo-herb': 12,
  // A spare standard-issue lantern - cheap safety net for anyone who unequips their only one.
  'keepers-lantern': 8,
  // Common-tier equipment only, per the canonical rarity progression (Common: "merchants, enemy
  // drops, common chests"). Uncommon/Rare gear comes from chests instead. Split with no overlap
  // between the two Ash Hallow gear shops: Blacksmith stocks Weapon/Charm/Spirit Totem (no totem
  // currently at common tier), Armory stocks Chest/Legs/Boots/Gloves.
  'weathered-walking-staff': 30,
  // Universal Sword weapon-type founder (docs/Mytherra-Equipment_breakdown.md's "Weapon Types"
  // section) - same common-tier price as weathered-walking-staff, its Staff-type sibling.
  'weathered-iron-sword': 30,
  'miners-pick': 28,
  'ashwood-spear': 27,
  'miners-mallet': 27,
  'river-stone-charm': 25,
  'worn-keeper-coat': 30,
  'worn-keeper-trousers': 26,
  'traveler-boots': 25,
  'work-gloves': 20,
  // Iron Mountains' own Uncommon/Rare items that had no other earn path (see SHOP_UNLOCK_TIERS
  // below - these only become purchasable once the-mountain-remembers completes). Priced above
  // their tier's usual chest-only peers since a shop purchase is a guaranteed, no-luck alternative.
  'mountain-knot': 55,
  'spiritwood-walking-staff': 140,
  'veteran-keeper-coat': 150,
  'veteran-keeper-trousers': 120,
  'trail-boots': 70,
  'keepers-gauntlets': 130,
  // Crimson Bayou - Cypress Cane/Bayou Vestments/Bayou Leg-Wraps/Marsh Boots/Mire Gloves/Bayou
  // Charm families, Common+Uncommon tiers (Rare comes from the region's own chests/boss instead,
  // same "shops stock the lower tiers" rule as Iron Mountains). Split the same Blacksmith/Armory
  // way: weapon/charm to Toussaint, chest/legs/boots/gloves to Delphine.
  'weathered-cypress-cane': 32,
  'bound-cypress-cane': 65,
  'marsh-reed-charm': 22,
  'swamp-talisman': 50,
  'tattered-bayou-vestments': 32,
  'woven-bayou-vestments': 65,
  'worn-bayou-leg-wraps': 28,
  'woven-bayou-leg-wraps': 58,
  'worn-marsh-boots': 26,
  'sturdy-marsh-boots': 60,
  'worn-mire-gloves': 22,
  'reinforced-mire-gloves': 52,
  // Bayou's own late-game unlock (see SHOP_UNLOCK_TIERS) - the one Rare item sold rather than
  // chest/boss-found, since it's a charm (Toussaint's own department) and no Bayou chest needed a
  // sixth slot for it.
  'witch-warded-charm': 145,
};

/** Additional items a shop unlocks once a specific quest completes, layered ON TOP of its
 *  SHOP_CATALOGS base stock (never a replacement) - lets a shop's stock grow as the player
 *  advances the MSQ without ever touching its base catalog. Any number of tiers per shop; a
 *  completed tier's items simply get added to that shop's effective catalog (see
 *  effectiveShopCatalog below). Adding a new region/shop's own late-game unlock is just a new
 *  entry here - no code changes needed anywhere else. */
export const SHOP_UNLOCK_TIERS: Record<string, { questId: string; itemIds: string[] }[]> = {
  'ash-hallow-blacksmith-forge': [{ questId: 'the-mountain-remembers', itemIds: ['spiritwood-walking-staff', 'mountain-knot'] }],
  'ash-hallow-armory': [
    { questId: 'the-mountain-remembers', itemIds: ['veteran-keeper-coat', 'veteran-keeper-trousers', 'trail-boots', 'keepers-gauntlets'] },
  ],
  'toussaint-forge': [{ questId: 'seeds-of-memory', itemIds: ['witch-warded-charm'] }],
};

/** A shop's full purchasable catalog right now - its base SHOP_CATALOGS stock plus every
 *  SHOP_UNLOCK_TIERS tier whose gating quest is already completed. `completedQuestIds` should be
 *  every quest id the player has finished (see purchaseItem.ts/Shop.tsx's own callers for how
 *  that set gets built from a PlayerSave vs. the client's quest-progress store). */
export function effectiveShopCatalog(shopId: string, completedQuestIds: Set<string>): string[] {
  const base = SHOP_CATALOGS[shopId] ?? [];
  const tiers = SHOP_UNLOCK_TIERS[shopId] ?? [];
  const unlocked = tiers.filter((tier) => completedQuestIds.has(tier.questId)).flatMap((tier) => tier.itemIds);
  return [...base, ...unlocked];
}

// Authoritative per-shop catalogs - purchaseItem.ts validates the requested itemId actually
// belongs to the given shopId, not just that it exists somewhere in SHOP_PRICES. Keep in sync by
// hand with src/data/items.ts's SHOP_CATALOGS (display copy).
export const SHOP_CATALOGS: Record<string, string[]> = {
  'mara-ash-general-store': ['keepers-lantern', 'antidote', 'eye-drops'],
  'ash-hallow-blacksmith-forge': [
    'weathered-walking-staff',
    'weathered-iron-sword',
    'miners-pick',
    'ashwood-spear',
    'miners-mallet',
    'river-stone-charm',
  ],
  'ash-hallow-armory': ['worn-keeper-coat', 'worn-keeper-trousers', 'traveler-boots', 'work-gloves'],
  apothecary: [
    'healing-poultice',
    'greater-healing-poultice',
    'spirit-draught',
    'lantern-oil',
    'antidote',
    'burn-salve',
    'thaw-crystal',
    'eye-drops',
    'echo-herb',
  ],
  // Crimson Bayou (Mirehaven)
  'remy-general-store': ['keepers-lantern', 'lantern-oil', 'antidote', 'eye-drops'],
  'noelle-herbalist': [
    'healing-poultice',
    'greater-healing-poultice',
    'spirit-draught',
    'lantern-oil',
    'antidote',
    'burn-salve',
    'thaw-crystal',
    'eye-drops',
    'echo-herb',
  ],
  // Common+Uncommon Cypress Cane/Bayou Charm stock (see SHOP_UNLOCK_TIERS for the Rare unlock).
  'toussaint-forge': ['weathered-cypress-cane', 'bound-cypress-cane', 'marsh-reed-charm', 'swamp-talisman'],
  // Common+Uncommon Bayou Vestments/Leg-Wraps/Marsh Boots/Mire Gloves stock - Rare tier of every
  // one of these families is chest/boss-found instead (see cypress-marsh/murkwater-trails/
  // hidden-river-landing's own chest loot and the Ancient Serpent Guardian's own loot table).
  'delphine-armory': [
    'tattered-bayou-vestments',
    'woven-bayou-vestments',
    'worn-bayou-leg-wraps',
    'woven-bayou-leg-wraps',
    'worn-marsh-boots',
    'sturdy-marsh-boots',
    'worn-mire-gloves',
    'reinforced-mire-gloves',
  ],
};

export const INN_REST_COST = 100;
