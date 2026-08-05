// Authoritative — the client's src/data/equipment.ts is a display copy only.

import type { AilmentResistance, EquipmentSlot } from '../shared-types';

// Re-exported (not redeclared) from shared-types - both files live inside functions/ (the same
// deployed bundle), so there's no risk of the src/ import resolving locally but 404ing once
// deployed the way there would be across the client/server boundary; independently redeclaring
// this identical union here just risked the two drifting the next time a slot is added/renamed.
export type { EquipmentSlot };
// Ascending order: Common < Uncommon < Rare < Mythic < Legendary. Per the canonical equipment
// design (docs/Mytherra-Equipment_breakdown.md) - Legendary is a named, story-tied artifact that
// ends its equipment family, ranked above Mythic.
export type Tier = 'common' | 'uncommon' | 'rare' | 'mythic' | 'legendary';

export interface StatBonuses {
  maxHp?: number;
  maxSpirit?: number;
  attack?: number;
  defense?: number;
  speed?: number;
}

export interface EquipmentDefinition {
  id: string;
  slot: EquipmentSlot;
  statBonuses: StatBonuses;
  tier: Tier;
  /** Which equipment family this belongs to (e.g. 'walking-staff') - display/grouping only
   *  (a future "collection" view), not read by any equip mechanic. Per the canonical design,
   *  each region contributes exactly one family per slot, Common through Rare in this pass;
   *  Mythic/Legendary rows wait for the quest content that will grant them. */
  familyId?: string;
  /** Caps ownership at 1 and blocks a second copy from ever being granted - for milestone-only
   *  gear, not shop stock. */
  unique?: boolean;
  /** Lantern-slot only: how much Lantern Oil this lantern holds, and which Lantern Ability
   *  id(s) (see data/lanternAbilities.ts) it grants while equipped. A lantern can grant more than
   *  one; non-lantern equipment leaves both fields undefined. */
  oilCapacity?: number;
  lanternAbilityIds?: string[];
  /** Weapon-slot only: a chance to inflict this ailment when this weapon lands a plain 'attack'
   *  (not Skill/lanternAbility, which have their own inflictsAilmentId path via Skill/
   *  LanternAbility) - mirrors Skill.inflictsAilmentId/inflictAilmentChance's shape and is gated
   *  the same way (the target's EnemyDefinition.vulnerableAilments, never on a defeating hit).
   *  Stubbed for future weapon content - no authored weapon sets this yet. */
  attackAilment?: { ailmentId: string; chance: number };
  /** Any slot: reduces the wielder's own chance of being afflicted by a matching ailment while
   *  equipped. Entries from every equipped item with a matching ailmentId sum (see
   *  combatMath.ts's applyAilmentResistance for the clamp). `reductionPercent` is a 0-1 FRACTION
   *  despite its name (1 = 100% resistance, matching applyAilmentResistance's own clamp to
   *  [0, 1]) - not a 0-100 number. First used by Crimson Bayou's mire-gloves/bayou-charm Rare
   *  tiers (Poison) and Iron Mountains' mountain-charm/work-gloves Rare tiers (Burn). */
  ailmentResistance?: AilmentResistance[];
}

// Iron Mountains canonical equipment families (docs/Mytherra-Equipment_breakdown.md). Common
// through Rare only in this pass - Mythic/Legendary rows (Warden's Maul, Memorykeeper's Staff,
// Mountain Guardian Mail, Mantle of Enduring Stone, Spiritwalker/Echostep Boots, Warden's Grips/
// Hands of the First Keeper, Moon Witch Talisman/Heart of the Mountain, Coal Spirit/Mountain
// Guardian Totem) wait for the quest content that will grant them.
export const EQUIPMENT: Record<string, EquipmentDefinition> = {
  'weathered-walking-staff': {
    id: 'weathered-walking-staff',
    slot: 'weapon',
    statBonuses: { maxSpirit: 5, attack: 4 },
    tier: 'common',
    familyId: 'walking-staff',
  },
  // Sword weapon type (docs/Mytherra-Equipment_breakdown.md's "Weapon Types" section) -
  // weathered-iron-sword is the universal Sword founder item: its (still-pending) layer sprite
  // becomes the shared palette-swap template for every region's own Sword-type family, the same
  // role weathered-walking-staff plays for Staff. Common-tier stat split mirrors
  // weathered-walking-staff's own (same total bonus budget), just attack-leaning instead of
  // spirit-leaning to read as a physical weapon rather than a spirit-focused one.
  'weathered-iron-sword': {
    id: 'weathered-iron-sword',
    slot: 'weapon',
    statBonuses: { attack: 7, speed: 1 },
    tier: 'common',
    familyId: 'iron-sword',
  },
  // Axe weapon type founder - heavier hit than Sword, at the cost of speed (leans defense instead
  // of the Sword line's speed-leaning split).
  'miners-pick': {
    id: 'miners-pick',
    slot: 'weapon',
    statBonuses: { attack: 6, defense: 1, speed: -1 },
    tier: 'common',
    familyId: 'miners-pick',
  },
  // Spear weapon type founder - reach/endurance flavor (HP bonus instead of Sword/Axe's
  // speed/defense split).
  'ashwood-spear': {
    id: 'ashwood-spear',
    slot: 'weapon',
    statBonuses: { attack: 5, maxHp: 4 },
    tier: 'common',
    familyId: 'ashwood-spear',
  },
  // Hammer weapon type founder - built one-handed (mace/war-maul, not a two-handed maul - no
  // held-two-hand anchor category exists). Heaviest/slowest of the 4 new types, defense-leaning.
  'miners-mallet': {
    id: 'miners-mallet',
    slot: 'weapon',
    statBonuses: { attack: 5, defense: 2, speed: -1 },
    tier: 'common',
    familyId: 'miners-mallet',
  },
  // Uncommon/Rare tiers of the 4 new Iron Mountains weapon-type families. Stat-tier budgets
  // mirror the walking-staff family's own progression (roughly matching magnitude at each tier),
  // one shared split per type: Sword leans speed, Axe/Hammer lean defense, Spear leans maxHp -
  // same split as their own common tier above, scaled up.
  'ironbound-sword': {
    id: 'ironbound-sword',
    slot: 'weapon',
    statBonuses: { attack: 9, speed: 2 },
    tier: 'uncommon',
    familyId: 'iron-sword',
  },
  'wardens-broadsword': {
    id: 'wardens-broadsword',
    slot: 'weapon',
    statBonuses: { attack: 13, speed: 3, defense: -1 },
    tier: 'rare',
    familyId: 'iron-sword',
  },
  'ironbound-axe': {
    id: 'ironbound-axe',
    slot: 'weapon',
    statBonuses: { attack: 9, defense: 2, speed: -1 },
    tier: 'uncommon',
    familyId: 'miners-pick',
  },
  'ghost-miners-axe': {
    id: 'ghost-miners-axe',
    slot: 'weapon',
    statBonuses: { attack: 14, defense: 3, speed: -3 },
    tier: 'rare',
    familyId: 'miners-pick',
  },
  'ironbound-spear': {
    id: 'ironbound-spear',
    slot: 'weapon',
    statBonuses: { attack: 8, maxHp: 6, speed: 1 },
    tier: 'uncommon',
    familyId: 'ashwood-spear',
  },
  'ridgehunters-spear': {
    id: 'ridgehunters-spear',
    slot: 'weapon',
    statBonuses: { attack: 12, maxHp: 10, defense: 1 },
    tier: 'rare',
    familyId: 'ashwood-spear',
  },
  'ironbound-war-maul': {
    id: 'ironbound-war-maul',
    slot: 'weapon',
    statBonuses: { attack: 8, defense: 3, speed: -2 },
    tier: 'uncommon',
    familyId: 'miners-mallet',
  },
  'ghostbreaker-warhammer': {
    id: 'ghostbreaker-warhammer',
    slot: 'weapon',
    statBonuses: { attack: 12, maxHp: 10, defense: 4, speed: -3 },
    tier: 'rare',
    familyId: 'miners-mallet',
  },
  'ironwood-walking-staff': {
    id: 'ironwood-walking-staff',
    slot: 'weapon',
    statBonuses: { maxSpirit: 3, attack: 7, speed: 1 },
    tier: 'uncommon',
    familyId: 'walking-staff',
  },
  'spiritwood-walking-staff': {
    id: 'spiritwood-walking-staff',
    slot: 'weapon',
    statBonuses: { maxHp: 10, attack: 10, defense: 2, speed: -2 },
    tier: 'rare',
    familyId: 'walking-staff',
  },
  'worn-keeper-coat': {
    id: 'worn-keeper-coat',
    slot: 'chest',
    statBonuses: { maxHp: 12, defense: 3 },
    tier: 'common',
    familyId: 'keeper-coat',
  },
  'reinforced-keeper-coat': {
    id: 'reinforced-keeper-coat',
    slot: 'chest',
    statBonuses: { maxHp: 18, defense: 5, speed: -1 },
    tier: 'uncommon',
    familyId: 'keeper-coat',
  },
  'veteran-keeper-coat': {
    id: 'veteran-keeper-coat',
    slot: 'chest',
    statBonuses: { maxHp: 20, maxSpirit: 8, defense: 7, speed: 1 },
    tier: 'rare',
    familyId: 'keeper-coat',
  },
  // Legs counterparts of the keeper-coat family - same three tiers, reduced-magnitude versions
  // of the matching coat's bonuses (per the canonical design, Legs is "lower protection" than
  // Chest, not a second full armor slot).
  'worn-keeper-trousers': {
    id: 'worn-keeper-trousers',
    slot: 'legs',
    statBonuses: { maxHp: 8, defense: 2 },
    tier: 'common',
    familyId: 'keeper-trousers',
  },
  'reinforced-keeper-trousers': {
    id: 'reinforced-keeper-trousers',
    slot: 'legs',
    statBonuses: { maxHp: 12, defense: 3, speed: -1 },
    tier: 'uncommon',
    familyId: 'keeper-trousers',
  },
  'veteran-keeper-trousers': {
    id: 'veteran-keeper-trousers',
    slot: 'legs',
    statBonuses: { maxHp: 14, maxSpirit: 4, defense: 4, speed: 1 },
    tier: 'rare',
    familyId: 'keeper-trousers',
  },
  'traveler-boots': {
    id: 'traveler-boots',
    slot: 'boots',
    statBonuses: { defense: 1, speed: 2 },
    tier: 'common',
    familyId: 'traveler-boots',
  },
  'trail-boots': {
    id: 'trail-boots',
    slot: 'boots',
    statBonuses: { defense: 2, speed: 4 },
    tier: 'uncommon',
    familyId: 'traveler-boots',
  },
  'ranger-boots': {
    id: 'ranger-boots',
    slot: 'boots',
    statBonuses: { attack: 1, defense: 3, speed: 6 },
    tier: 'rare',
    familyId: 'traveler-boots',
  },
  'work-gloves': {
    id: 'work-gloves',
    slot: 'gloves',
    statBonuses: { attack: 1, defense: 1 },
    tier: 'common',
    familyId: 'work-gloves',
  },
  'leather-gauntlets': {
    id: 'leather-gauntlets',
    slot: 'gloves',
    statBonuses: { maxHp: 5, attack: 2, defense: 2 },
    tier: 'uncommon',
    familyId: 'work-gloves',
  },
  // The family's Rare cap gets a genuine Burn resistance perk rather than just bigger numbers -
  // matching warden-warden-wrath/coalspirit-cinderburst's Burn being Iron Mountains' own
  // signature status threat, the same way mire-gloves' Rare cap resists Poison for the Bayou.
  'keepers-gauntlets': {
    id: 'keepers-gauntlets',
    slot: 'gloves',
    statBonuses: { maxHp: 8, attack: 4, defense: 4 },
    tier: 'rare',
    familyId: 'work-gloves',
    ailmentResistance: [{ ailmentId: 'burn', reductionPercent: 0.3 }],
  },
  'river-stone-charm': {
    id: 'river-stone-charm',
    slot: 'charm',
    statBonuses: { maxHp: 5 },
    tier: 'common',
    familyId: 'mountain-charm',
  },
  'mountain-knot': {
    id: 'mountain-knot',
    slot: 'charm',
    statBonuses: { speed: 2 },
    tier: 'uncommon',
    familyId: 'mountain-charm',
    ailmentResistance: [{ ailmentId: 'burn', reductionPercent: 0.15 }],
  },
  'ghost-miners-coin': {
    id: 'ghost-miners-coin',
    slot: 'charm',
    statBonuses: { maxSpirit: 5 },
    tier: 'rare',
    familyId: 'mountain-charm',
    ailmentResistance: [{ ailmentId: 'burn', reductionPercent: 0.3 }],
  },
  'keepers-lantern': {
    id: 'keepers-lantern',
    slot: 'lantern',
    statBonuses: { maxSpirit: 5 },
    tier: 'legendary',
    // 30, not the original 20 - at lantern-flame's 8 oil/cast that was only 2.5 casts/tank,
    // proportionally stingier than the endgame lantern's 35/10 = 3.5 - 30/8 = 3.75 brings the
    // starter lantern back in line with (slightly past) what it's meant to be upgraded from.
    oilCapacity: 30,
    lanternAbilityIds: ['lantern-flame'],
  },
  'miners-lost-lantern-equipped': {
    id: 'miners-lost-lantern-equipped',
    slot: 'lantern',
    statBonuses: { maxSpirit: 14, defense: 2 },
    tier: 'legendary',
    unique: true,
    oilCapacity: 35,
    lanternAbilityIds: ['steadfast-ember'],
  },
  'stone-wolf-totem': {
    id: 'stone-wolf-totem',
    slot: 'spiritTotem',
    statBonuses: { attack: 6 },
    tier: 'rare',
    familyId: 'mountain-spirits',
  },
  // Legendary reward for defeating the Coalbound Warden (MSF-IM-011) - the first Legendary
  // Spirit Totem, now that the quest content granting it exists.
  'mountain-guardian-totem': {
    id: 'mountain-guardian-totem',
    slot: 'spiritTotem',
    statBonuses: { maxHp: 15, attack: 12, defense: 8 },
    tier: 'legendary',
    unique: true,
    familyId: 'mountain-spirits',
  },
  // Crimson Bayou (MSQ Volume II): the region's Legendary Lantern (MSF-CB-008), following the same
  // found-item-then-equipped-upgrade pattern as miners-lost-lantern-equipped. No layerSpriteAssetId
  // yet - equipment-layer sprite generation is out of scope for this region build (per the approved
  // plan); the item is fully functional (stats, ability, inventory icon) without one, same as most
  // equipment in this game before its own layer art exists.
  'lantern-of-still-waters-equipped': {
    id: 'lantern-of-still-waters-equipped',
    slot: 'lantern',
    statBonuses: { maxSpirit: 16, defense: 3 },
    tier: 'legendary',
    unique: true,
    oilCapacity: 35,
    lanternAbilityIds: ['still-waters-calm'],
  },
  // Legendary reward for defeating the Ancient Serpent Guardian (MSF-CB-009).
  'mother-cypress-totem': {
    id: 'mother-cypress-totem',
    slot: 'spiritTotem',
    statBonuses: { maxSpirit: 20, maxHp: 10, defense: 6 },
    tier: 'legendary',
    unique: true,
    familyId: 'cypress-spirits',
  },
  // Crimson Bayou's own Common-through-Rare equipment families (docs/Mytherra-Equipment_breakdown.md
  // Region 2 table: Cypress Cane / Bayou Vestments / Bayou Leg-Wraps / Marsh Boots / Mire Gloves /
  // Bayou Charm / Cypress Spirits) - same "one new family per slot per region" pattern Iron
  // Mountains established, so higher Iron Mountains tiers stay relevant by their own perks rather
  // than being obsoleted. No layerSpriteAssetId yet for weapon/chest/legs/boots/gloves - same
  // "fully functional without one, added later" precedent as lantern-of-still-waters-equipped
  // above and the keeper-trousers family before its own layer art existed.
  'weathered-cypress-cane': {
    id: 'weathered-cypress-cane',
    slot: 'weapon',
    statBonuses: { maxSpirit: 6, attack: 3, speed: 1 },
    tier: 'common',
    familyId: 'cypress-cane',
  },
  'bound-cypress-cane': {
    id: 'bound-cypress-cane',
    slot: 'weapon',
    statBonuses: { maxSpirit: 4, attack: 6, speed: 2 },
    tier: 'uncommon',
    familyId: 'cypress-cane',
  },
  // Named separately from the cane family in the design doc ("Rougarou Fang Blade") but slotted as
  // its Rare tier - same family progression shape as every other Rare cap in this pass.
  'rougarou-fang-blade': {
    id: 'rougarou-fang-blade',
    slot: 'weapon',
    statBonuses: { maxHp: 8, attack: 11, speed: 3, defense: -1 },
    tier: 'rare',
    familyId: 'cypress-cane',
  },
  // Crimson Bayou's own 4 new weapon-type families (docs/Mytherra-Equipment_breakdown.md's
  // "Weapon Types" section) - same per-type stat split/budget as Iron Mountains' own 4 families
  // (Sword leans speed, Axe/Hammer lean defense, Spear leans maxHp), palette-swapped from the
  // same universal founders once their layer art is hand-positioned.
  'weathered-bog-cutlass': {
    id: 'weathered-bog-cutlass',
    slot: 'weapon',
    statBonuses: { attack: 7, speed: 1 },
    tier: 'common',
    familyId: 'bog-cutlass',
  },
  'bound-bog-cutlass': {
    id: 'bound-bog-cutlass',
    slot: 'weapon',
    statBonuses: { attack: 9, speed: 2 },
    tier: 'uncommon',
    familyId: 'bog-cutlass',
  },
  'serpent-fang-sword': {
    id: 'serpent-fang-sword',
    slot: 'weapon',
    statBonuses: { attack: 13, speed: 3, defense: -1 },
    tier: 'rare',
    familyId: 'bog-cutlass',
  },
  'weathered-bog-axe': {
    id: 'weathered-bog-axe',
    slot: 'weapon',
    statBonuses: { attack: 6, defense: 1, speed: -1 },
    tier: 'common',
    familyId: 'bog-axe',
  },
  'bound-bog-axe': {
    id: 'bound-bog-axe',
    slot: 'weapon',
    statBonuses: { attack: 9, defense: 2, speed: -1 },
    tier: 'uncommon',
    familyId: 'bog-axe',
  },
  'rougarou-claw-axe': {
    id: 'rougarou-claw-axe',
    slot: 'weapon',
    statBonuses: { attack: 14, defense: 3, speed: -3 },
    tier: 'rare',
    familyId: 'bog-axe',
  },
  'weathered-reed-spear': {
    id: 'weathered-reed-spear',
    slot: 'weapon',
    statBonuses: { attack: 5, maxHp: 4 },
    tier: 'common',
    familyId: 'reed-spear',
  },
  'bound-reed-spear': {
    id: 'bound-reed-spear',
    slot: 'weapon',
    statBonuses: { attack: 8, maxHp: 6, speed: 1 },
    tier: 'uncommon',
    familyId: 'reed-spear',
  },
  'serpent-guard-spear': {
    id: 'serpent-guard-spear',
    slot: 'weapon',
    statBonuses: { attack: 12, maxHp: 10, defense: 1 },
    tier: 'rare',
    familyId: 'reed-spear',
  },
  'weathered-bog-maul': {
    id: 'weathered-bog-maul',
    slot: 'weapon',
    statBonuses: { attack: 5, defense: 2, speed: -1 },
    tier: 'common',
    familyId: 'bog-maul',
  },
  'bound-bog-maul': {
    id: 'bound-bog-maul',
    slot: 'weapon',
    statBonuses: { attack: 8, defense: 3, speed: -2 },
    tier: 'uncommon',
    familyId: 'bog-maul',
  },
  'rougarou-warclub': {
    id: 'rougarou-warclub',
    slot: 'weapon',
    statBonuses: { attack: 12, maxHp: 10, defense: 4, speed: -3 },
    tier: 'rare',
    familyId: 'bog-maul',
  },
  'tattered-bayou-vestments': {
    id: 'tattered-bayou-vestments',
    slot: 'chest',
    statBonuses: { maxHp: 10, defense: 2, speed: 1 },
    tier: 'common',
    familyId: 'bayou-vestments',
  },
  'woven-bayou-vestments': {
    id: 'woven-bayou-vestments',
    slot: 'chest',
    statBonuses: { maxHp: 15, defense: 4, speed: 2 },
    tier: 'uncommon',
    familyId: 'bayou-vestments',
  },
  'warden-bayou-vestments': {
    id: 'warden-bayou-vestments',
    slot: 'chest',
    statBonuses: { maxHp: 18, maxSpirit: 6, defense: 6, speed: 3 },
    tier: 'rare',
    familyId: 'bayou-vestments',
  },
  'worn-bayou-leg-wraps': {
    id: 'worn-bayou-leg-wraps',
    slot: 'legs',
    statBonuses: { maxHp: 6, defense: 1, speed: 1 },
    tier: 'common',
    familyId: 'bayou-leg-wraps',
  },
  'woven-bayou-leg-wraps': {
    id: 'woven-bayou-leg-wraps',
    slot: 'legs',
    statBonuses: { maxHp: 9, defense: 2, speed: 2 },
    tier: 'uncommon',
    familyId: 'bayou-leg-wraps',
  },
  'warden-bayou-leg-wraps': {
    id: 'warden-bayou-leg-wraps',
    slot: 'legs',
    statBonuses: { maxHp: 11, maxSpirit: 3, defense: 3, speed: 3 },
    tier: 'rare',
    familyId: 'bayou-leg-wraps',
  },
  'worn-marsh-boots': {
    id: 'worn-marsh-boots',
    slot: 'boots',
    statBonuses: { defense: 1, speed: 3 },
    tier: 'common',
    familyId: 'marsh-boots',
  },
  'sturdy-marsh-boots': {
    id: 'sturdy-marsh-boots',
    slot: 'boots',
    statBonuses: { defense: 2, speed: 5 },
    tier: 'uncommon',
    familyId: 'marsh-boots',
  },
  'mosswalker-boots': {
    id: 'mosswalker-boots',
    slot: 'boots',
    statBonuses: { attack: 1, defense: 3, speed: 7 },
    tier: 'rare',
    familyId: 'marsh-boots',
  },
  'worn-mire-gloves': {
    id: 'worn-mire-gloves',
    slot: 'gloves',
    statBonuses: { attack: 1, defense: 1 },
    tier: 'common',
    familyId: 'mire-gloves',
  },
  'reinforced-mire-gloves': {
    id: 'reinforced-mire-gloves',
    slot: 'gloves',
    statBonuses: { maxHp: 4, attack: 2, defense: 2 },
    tier: 'uncommon',
    familyId: 'mire-gloves',
  },
  // The family's Rare cap gets a genuine Poison resistance perk rather than just bigger numbers -
  // handling mire life without getting stung by it - matching hag-withering-hex's Poison
  // (bog-hag/cypress-witch) being this region's signature status threat.
  'warden-mire-gloves': {
    id: 'warden-mire-gloves',
    slot: 'gloves',
    statBonuses: { maxHp: 7, attack: 3, defense: 4 },
    tier: 'rare',
    familyId: 'mire-gloves',
    ailmentResistance: [{ ailmentId: 'poison', reductionPercent: 0.3 }],
  },
  'marsh-reed-charm': {
    id: 'marsh-reed-charm',
    slot: 'charm',
    statBonuses: { maxSpirit: 3 },
    tier: 'common',
    familyId: 'bayou-charm',
  },
  'swamp-talisman': {
    id: 'swamp-talisman',
    slot: 'charm',
    statBonuses: { speed: 2 },
    tier: 'uncommon',
    familyId: 'bayou-charm',
    ailmentResistance: [{ ailmentId: 'poison', reductionPercent: 0.15 }],
  },
  'witch-warded-charm': {
    id: 'witch-warded-charm',
    slot: 'charm',
    statBonuses: { maxSpirit: 6 },
    tier: 'rare',
    familyId: 'bayou-charm',
    ailmentResistance: [{ ailmentId: 'poison', reductionPercent: 0.3 }],
  },
  // Cypress Spirits family, Rare and Mythic tiers - mother-cypress-totem above is this family's
  // Legendary cap (already granted as the Ancient Serpent Guardian's boss reward).
  'swamp-wisp-totem': {
    id: 'swamp-wisp-totem',
    slot: 'spiritTotem',
    statBonuses: { speed: 4, maxSpirit: 3 },
    tier: 'rare',
    familyId: 'cypress-spirits',
  },
  'cypress-guardian-totem': {
    id: 'cypress-guardian-totem',
    slot: 'spiritTotem',
    statBonuses: { maxHp: 8, maxSpirit: 8, defense: 3 },
    tier: 'mythic',
    familyId: 'cypress-spirits',
  },
  // Prologue reward (MSF-P-001) - a starting-kit armor piece, not part of any regional family.
  // Not unique - it's a plain wool cloak given to every new Lantern Keeper, not a one-of-a-kind
  // relic, so owning it doesn't need to block ever granting another copy.
  'travelers-cloak': {
    id: 'travelers-cloak',
    slot: 'chest',
    statBonuses: { maxHp: 5, speed: 1 },
    tier: 'common',
  },
  // Prologue reward (MSF-P-001), matching lower for travelers-cloak - granted/auto-equipped
  // alongside it. Not unique, same reasoning as travelers-cloak above.
  'traveler-pants': {
    id: 'traveler-pants',
    slot: 'legs',
    statBonuses: { maxHp: 3, speed: 1 },
    tier: 'common',
  },

  // --- Endless Prairie (MSQ Volume III) canonical equipment families ---
  // Common through Rare only, matching every prior region's own first pass - Mythic/Legendary
  // rows (White Buffalo Totem's higher tiers, etc.) wait for Chapter 6's quest content.
  // Prairie Spear is a straight palette-swap of the Spear weapon type's founder (ashwood-spear) -
  // same stat progression as every other region's Spear-type instance (weapon TYPES share a flat
  // stat budget across regions, unlike armor families, which get the region-to-region power-creep
  // treatment below - see reed-spear's identical numbers in Crimson Bayou above).
  'weathered-prairie-spear': {
    id: 'weathered-prairie-spear',
    slot: 'weapon',
    statBonuses: { attack: 5, maxHp: 4 },
    tier: 'common',
    familyId: 'prairie-spear',
  },
  'bound-prairie-spear': {
    id: 'bound-prairie-spear',
    slot: 'weapon',
    statBonuses: { attack: 8, maxHp: 6, speed: 1 },
    tier: 'uncommon',
    familyId: 'prairie-spear',
  },
  'windriders-spear': {
    id: 'windriders-spear',
    slot: 'weapon',
    statBonuses: { attack: 12, maxHp: 10, defense: 1 },
    tier: 'rare',
    familyId: 'prairie-spear',
  },
  // Buffalo Hide (chest) - a step above Crimson Bayou's own Bayou Vestments, speed-leaning per the
  // region's Speed/Critical/Balanced-offense theme (docs/Mytherra-Equipment_breakdown.md).
  'worn-buffalo-hide': {
    id: 'worn-buffalo-hide',
    slot: 'chest',
    statBonuses: { maxHp: 12, defense: 2, speed: 2 },
    tier: 'common',
    familyId: 'buffalo-hide',
  },
  'banded-buffalo-hide': {
    id: 'banded-buffalo-hide',
    slot: 'chest',
    statBonuses: { maxHp: 17, defense: 4, speed: 3 },
    tier: 'uncommon',
    familyId: 'buffalo-hide',
  },
  'chieftains-buffalo-hide': {
    id: 'chieftains-buffalo-hide',
    slot: 'chest',
    statBonuses: { maxHp: 20, maxSpirit: 6, defense: 6, speed: 4 },
    tier: 'rare',
    familyId: 'buffalo-hide',
  },
  // Rider's Chaps (legs) - matches Buffalo Hide's own step-above-Bayou-Leg-Wraps progression.
  'worn-riders-chaps': {
    id: 'worn-riders-chaps',
    slot: 'legs',
    statBonuses: { maxHp: 7, defense: 1, speed: 2 },
    tier: 'common',
    familyId: 'riders-chaps',
  },
  'banded-riders-chaps': {
    id: 'banded-riders-chaps',
    slot: 'legs',
    statBonuses: { maxHp: 10, defense: 2, speed: 3 },
    tier: 'uncommon',
    familyId: 'riders-chaps',
  },
  'windborn-riders-chaps': {
    id: 'windborn-riders-chaps',
    slot: 'legs',
    statBonuses: { maxHp: 12, maxSpirit: 3, defense: 3, speed: 4 },
    tier: 'rare',
    familyId: 'riders-chaps',
  },
  // Wind Boots - a step above Marsh Boots, leaning even harder into speed than Bayou's own boots
  // did, matching the region's own theme.
  'worn-wind-boots': {
    id: 'worn-wind-boots',
    slot: 'boots',
    statBonuses: { defense: 1, speed: 4 },
    tier: 'common',
    familyId: 'wind-boots',
  },
  'swift-wind-boots': {
    id: 'swift-wind-boots',
    slot: 'boots',
    statBonuses: { defense: 2, speed: 6 },
    tier: 'uncommon',
    familyId: 'wind-boots',
  },
  'windrunner-boots': {
    id: 'windrunner-boots',
    slot: 'boots',
    statBonuses: { attack: 1, defense: 3, speed: 8 },
    tier: 'rare',
    familyId: 'wind-boots',
  },
  // Rider Gloves - a step above Mire Gloves. Rare cap gets a genuine Silence resistance perk, same
  // "Rare-tier resistance to the region's own signature ailment" pattern as warden-mire-gloves'
  // Poison resistance above - Silence is Endless Prairie's own signature threat (windSpirits'
  // wisp-hush-gale).
  'worn-rider-gloves': {
    id: 'worn-rider-gloves',
    slot: 'gloves',
    statBonuses: { attack: 1, defense: 2 },
    tier: 'common',
    familyId: 'rider-gloves',
  },
  'reinforced-rider-gloves': {
    id: 'reinforced-rider-gloves',
    slot: 'gloves',
    statBonuses: { maxHp: 5, attack: 3, defense: 3 },
    tier: 'uncommon',
    familyId: 'rider-gloves',
  },
  'warden-rider-gloves': {
    id: 'warden-rider-gloves',
    slot: 'gloves',
    statBonuses: { maxHp: 8, attack: 4, defense: 5 },
    tier: 'rare',
    familyId: 'rider-gloves',
    ailmentResistance: [{ ailmentId: 'silence', reductionPercent: 0.3 }],
  },
  // Sky Charm - a step above Bayou Charm, same Uncommon+Rare Silence-resistance split as the Bayou
  // Charm family's own Poison resistance.
  'feather-sky-charm': {
    id: 'feather-sky-charm',
    slot: 'charm',
    statBonuses: { maxSpirit: 4 },
    tier: 'common',
    familyId: 'sky-charm',
  },
  'woven-sky-charm': {
    id: 'woven-sky-charm',
    slot: 'charm',
    statBonuses: { speed: 3 },
    tier: 'uncommon',
    familyId: 'sky-charm',
    ailmentResistance: [{ ailmentId: 'silence', reductionPercent: 0.15 }],
  },
  // Named for the side quest's own unrecorded Lantern Keeper (see docs/Mytherra-SQ_breakdown.md,
  // "The Winter Counts") - the same kind of story-flavor naming windrunner-boots draws from the
  // region's own catalog examples.
  'skywalkers-charm': {
    id: 'skywalkers-charm',
    slot: 'charm',
    statBonuses: { maxSpirit: 7 },
    tier: 'rare',
    familyId: 'sky-charm',
    ailmentResistance: [{ ailmentId: 'silence', reductionPercent: 0.3 }],
  },
  // White Buffalo Totem family (docs/Mytherra-Equipment_breakdown.md) - missed during the initial
  // Chapter 5 equipment pass (every other region got its own Totem family; Prairie didn't), added
  // retroactively as Chapter 6's Phase 0. Rare tier here, a step above Crimson Bayou's own
  // cypress-spirits Rare (swamp-wisp-totem: speed 4/maxSpirit 3), matching the established
  // power-creep-by-story-position convention. Mythic/Legendary tiers come from Chapter 6's boss.
  'white-buffalo-totem': {
    id: 'white-buffalo-totem',
    slot: 'spiritTotem',
    statBonuses: { speed: 5, maxSpirit: 4 },
    tier: 'rare',
    familyId: 'white-buffalo-totem',
  },
};
