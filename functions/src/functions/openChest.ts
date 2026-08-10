import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { grantItem } from '../engine/inventoryEngine';
import { applyLevelUp } from '../engine/levelingEngine';
import type { PlayerSave } from '../shared-types';

interface OpenChestRequest {
  locationId: string;
  chestId: string;
}

interface ChestReward {
  itemId: string;
  /** Defaults to 1 - only set for a material grant that should feel a cut above a single enemy
   *  drop (see the "x2 for materials" convention below). */
  itemQuantity?: number;
  gold: number;
  xp: number;
}

/** Server-side source of truth for what a given map's chest interactable grants. Every chest
 *  grants gold + xp (scaled per region/chapter to roughly 2x an average regular-enemy kill of
 *  that tier - see data/enemies.ts's own xpReward/goldReward progression) plus one item.
 *  Equipment chests keep the existing Uncommon/Rare-only policy - common gear is shop stock, and
 *  unique relics are quest/boss rewards, not something that belongs behind a repeatable-looking
 *  world object. Per the canonical equipment design: `spiritwood-walking-staff`,
 *  `veteran-keeper-coat`, and `mountain-knot` have no earn path yet - they become quest rewards
 *  once that content exists. Material/consumable chests alternate between the region's own
 *  materials (and, where one exists, its otherwise-unused Uncommon-tier material) and a
 *  tier-appropriate consumable, so no two chests on the same map (or, for single-chest dungeon
 *  rooms, across the same dungeon) hand out the exact same single item - the pre-2026-08 tables
 *  had several duplicates (see the chest-loot audit). */
const CHESTS: Record<string, Record<string, ChestReward>> = {
  'ironwood-trail': {
    'chest-ironwood-1': { itemId: 'ironwood-walking-staff', gold: 20, xp: 30 },
    'chest-ironwood-2': { itemId: 'ranger-boots', gold: 20, xp: 30 },
    'chest-ironwood-3': { itemId: 'ghost-miners-coin', gold: 20, xp: 30 },
  },
  'hollow-rail-mine': {
    'chest-mine-1': { itemId: 'reinforced-keeper-coat', gold: 20, xp: 30 },
    'chest-mine-2': { itemId: 'leather-gauntlets', gold: 20, xp: 30 },
    'chest-mine-3': { itemId: 'stone-wolf-totem', gold: 20, xp: 30 },
  },
  // Crimson Bayou field maps - Rare-tier equipment (Cypress Cane/Bayou Vestments/Bayou
  // Leg-Wraps/Marsh Boots/Mire Gloves/Cypress Spirits families - see equipment.ts), plus one
  // materials chest per map. murkwater-trails-3 uses rougarou-claw (the region's Uncommon-tier
  // material, previously never granted by any chest) instead of doubling up on the common-tier
  // croc-hide/bog-ash split cypress-marsh already covers.
  'cypress-marsh': {
    'chest-cypress-marsh-1': { itemId: 'rougarou-fang-blade', gold: 25, xp: 45 },
    'chest-cypress-marsh-2': { itemId: 'warden-bayou-vestments', gold: 25, xp: 45 },
    'chest-cypress-marsh-3': { itemId: 'croc-hide', itemQuantity: 2, gold: 25, xp: 45 },
  },
  'murkwater-trails': {
    'chest-murkwater-trails-1': { itemId: 'mosswalker-boots', gold: 25, xp: 45 },
    'chest-murkwater-trails-2': { itemId: 'warden-mire-gloves', gold: 25, xp: 45 },
    'chest-murkwater-trails-3': { itemId: 'rougarou-claw', gold: 25, xp: 45 },
  },
  'hidden-river-landing': {
    'chest-hidden-river-landing-1': { itemId: 'warden-bayou-leg-wraps', gold: 25, xp: 45 },
    'chest-hidden-river-landing-2': { itemId: 'swamp-wisp-totem', gold: 25, xp: 45 },
    'chest-hidden-river-landing-3': { itemId: 'ancient-serpent-scale', gold: 25, xp: 45 },
  },
  // Endless Prairie (MSQ Volume III, Chapter 5) - 5 field maps instead of Bayou's 3, so the 6 Rare
  // equipment pieces spread 1-2 per map instead of a flat "2 equipment + 1 material" split;
  // materials fill every other chest slot.
  'golden-prairie': {
    'chest-golden-prairie-1': { itemId: 'windriders-spear', gold: 30, xp: 55 },
    'chest-golden-prairie-2': { itemId: 'wisp-feather', itemQuantity: 2, gold: 30, xp: 55 },
    'chest-golden-prairie-3': { itemId: 'prairie-wolf-pelt', itemQuantity: 2, gold: 30, xp: 55 },
  },
  'spirit-herd-plains': {
    'chest-spirit-herd-plains-1': { itemId: 'chieftains-buffalo-hide', gold: 30, xp: 55 },
    'chest-spirit-herd-plains-2': { itemId: 'windborn-riders-chaps', gold: 30, xp: 55 },
    'chest-spirit-herd-plains-3': { itemId: 'wisp-feather', itemQuantity: 2, gold: 30, xp: 55 },
  },
  'sacred-hills': {
    'chest-sacred-hills-1': { itemId: 'windrunner-boots', gold: 30, xp: 55 },
    'chest-sacred-hills-2': { itemId: 'warden-rider-gloves', gold: 30, xp: 55 },
    'chest-sacred-hills-3': { itemId: 'prairie-wolf-pelt', itemQuantity: 2, gold: 30, xp: 55 },
  },
  'stone-circle-valley': {
    'chest-stone-circle-valley-1': { itemId: 'skywalkers-charm', gold: 30, xp: 55 },
    // White Buffalo Totem's Rare tier - retroactive Chapter 5 fix (docs/Mytherra-Equipment_
    // breakdown.md always intended Prairie to have a Totem family; missed in the original pass).
    'chest-stone-circle-valley-2': { itemId: 'white-buffalo-totem', gold: 30, xp: 55 },
    'chest-stone-circle-valley-3': { itemId: 'prairie-wolf-pelt', itemQuantity: 2, gold: 30, xp: 55 },
  },
  'thunderbird-mesa-approach': {
    'chest-thunderbird-mesa-approach-1': { itemId: 'wisp-feather', itemQuantity: 2, gold: 30, xp: 55 },
  },
  // Whispering Pines (MSQ Volume IV, Chapter 7) - the 6 Rare equipment pieces plus Young Cedar
  // Totem's Rare tier spread 1-2 per map, matching Endless Prairie's own "spread across 5 field
  // maps" split. mistwood-path-3 uses gnarled-root-fiber (previously ungranted by any chest)
  // instead of repeating withered-echo-moss a second time on the same map.
  'mistwood-path': {
    'chest-mistwood-path-1': { itemId: 'ancient-cedar-staff', gold: 35, xp: 65 },
    'chest-mistwood-path-2': { itemId: 'withered-echo-moss', itemQuantity: 2, gold: 35, xp: 65 },
    'chest-mistwood-path-3': { itemId: 'gnarled-root-fiber', itemQuantity: 2, gold: 35, xp: 65 },
  },
  'elder-forest': {
    'chest-elder-forest-1': { itemId: 'elderwood-bark-armor', gold: 35, xp: 65 },
    'chest-elder-forest-2': { itemId: 'deep-root-leggings', gold: 35, xp: 65 },
    'chest-elder-forest-3': { itemId: 'withered-echo-moss', itemQuantity: 2, gold: 35, xp: 65 },
  },
  'silver-river': {
    'chest-silver-river-1': { itemId: 'ancient-root-boots', gold: 35, xp: 65 },
    'chest-silver-river-2': { itemId: 'warden-vine-gloves', gold: 35, xp: 65 },
    'chest-silver-river-3': { itemId: 'withered-echo-moss', itemQuantity: 2, gold: 35, xp: 65 },
  },
  'ancient-cedar-shrine': {
    'chest-ancient-cedar-shrine-1': { itemId: 'elders-cedar-charm', gold: 35, xp: 65 },
    // Young Cedar Totem's Rare tier - built in the same chapter that introduces the family this
    // time, not retroactively patched in later the way White Buffalo Totem's own Rare tier was.
    'chest-ancient-cedar-shrine-2': { itemId: 'young-cedar-totem', gold: 35, xp: 65 },
    'chest-ancient-cedar-shrine-3': { itemId: 'withered-echo-moss', itemQuantity: 2, gold: 35, xp: 65 },
  },
  'heartwood-approach': {
    'chest-heartwood-approach-1': { itemId: 'withered-echo-moss', itemQuantity: 2, gold: 35, xp: 65 },
  },
  // Shattered Desert (MSQ Volume V, Chapter 9) - the 6 Rare equipment pieces plus Sunstone
  // Totem's Rare tier spread 1-2 per map, matching every prior region's own split.
  // sunfire-dunes-3 uses starlight-dust instead of repeating sandglass-shard a second time.
  'sunfire-dunes': {
    'chest-sunfire-dunes-1': { itemId: 'solaris-blade', gold: 45, xp: 85 },
    'chest-sunfire-dunes-2': { itemId: 'sandglass-shard', itemQuantity: 2, gold: 45, xp: 85 },
    'chest-sunfire-dunes-3': { itemId: 'starlight-dust', itemQuantity: 2, gold: 45, xp: 85 },
  },
  'crimson-canyons': {
    'chest-crimson-canyons-1': { itemId: 'starwoven-nomad-robes', gold: 45, xp: 85 },
    'chest-crimson-canyons-2': { itemId: 'starwoven-nomad-leggings', gold: 45, xp: 85 },
    'chest-crimson-canyons-3': { itemId: 'sandglass-shard', itemQuantity: 2, gold: 45, xp: 85 },
  },
  'painted-mesas': {
    'chest-painted-mesas-1': { itemId: 'sunrunner-boots', gold: 45, xp: 85 },
    'chest-painted-mesas-2': { itemId: 'rangers-dune-wraps', gold: 45, xp: 85 },
    'chest-painted-mesas-3': { itemId: 'sandglass-shard', itemQuantity: 2, gold: 45, xp: 85 },
  },
  'celestial-oasis': {
    'chest-celestial-oasis-1': { itemId: 'astral-star-charm', gold: 45, xp: 85 },
    // Sunstone Totem's Rare tier - built now rather than retroactively patched in later.
    'chest-celestial-oasis-2': { itemId: 'sunstone-totem', gold: 45, xp: 85 },
    'chest-celestial-oasis-3': { itemId: 'sandglass-shard', itemQuantity: 2, gold: 45, xp: 85 },
  },
  'forgotten-observatory-approach': {
    'chest-forgotten-observatory-approach-1': { itemId: 'sandglass-shard', itemQuantity: 2, gold: 45, xp: 85 },
  },
  // Frozen Frontier (MSQ Volume VI, Chapter 11) - Rare-tier equipment distributed across field-map
  // chests, matching the established Common+Uncommon-shop/Rare-chest split.
  // hall-of-eternal-winter-approach used to be the single worst offender in the loot audit: all 3
  // of its chests granted the exact same frost-wolf-fang - now diversified, closing with a Rare
  // consumable right before the region's finale dungeon.
  'snowveil-forest': {
    'chest-snowveil-forest-1': { itemId: 'glacier-forged-pike', gold: 45, xp: 90 },
    'chest-snowveil-forest-2': { itemId: 'auroraweave-coat', gold: 45, xp: 90 },
    'chest-snowveil-forest-3': { itemId: 'frost-wolf-fang', itemQuantity: 2, gold: 45, xp: 90 },
  },
  'frozen-river': {
    'chest-frozen-river-1': { itemId: 'auroraweave-leggings', gold: 45, xp: 90 },
    'chest-frozen-river-2': { itemId: 'frostwardens-boots', gold: 45, xp: 90 },
    'chest-frozen-river-3': { itemId: 'frost-wolf-fang', itemQuantity: 2, gold: 45, xp: 90 },
  },
  'glacier-pass': {
    'chest-glacier-pass-1': { itemId: 'frostwardens-gloves', gold: 45, xp: 90 },
    'chest-glacier-pass-2': { itemId: 'radiant-aurora-charm', gold: 45, xp: 90 },
    'chest-glacier-pass-3': { itemId: 'frost-wolf-fang', itemQuantity: 2, gold: 45, xp: 90 },
  },
  'aurora-basin': {
    'chest-aurora-basin-1': { itemId: 'winter-stag-totem', gold: 45, xp: 90 },
    'chest-aurora-basin-2': { itemId: 'frost-wolf-fang', itemQuantity: 2, gold: 45, xp: 90 },
  },
  'hall-of-eternal-winter-approach': {
    'chest-hall-of-eternal-winter-approach-1': { itemId: 'frost-wolf-fang', itemQuantity: 2, gold: 45, xp: 90 },
    'chest-hall-of-eternal-winter-approach-2': { itemId: 'frozen-essence', itemQuantity: 2, gold: 45, xp: 90 },
    'chest-hall-of-eternal-winter-approach-3': { itemId: 'superior-healing-poultice', gold: 45, xp: 90 },
  },
  // --- Dungeon interior chests. Originally added retroactively (every dungeon room from Chapter 6
  // onward had a chest placed on its map spec but no CHESTS entry, so opening any of these threw
  // "There is no chest here." - see the 2026-08 quest/chest wiring audit) as a single flat
  // region-material grant. The 2026-08 loot audit flagged all of these as monotonous (every chest
  // in a given dungeon handed out the exact same single common material with no gold/xp/consumable
  // at all) - each dungeon's chests now alternate between the region's two materials and a
  // tier-appropriate consumable (Uncommon "greater-" tier for the earlier dungeons, climbing to
  // Rare "superior-" and finally Mythic "pristine-" for the very last chest in the game), with
  // gold/xp scaled the same as that chapter's field maps.
  'summit-temple': { 'chest-summit-temple-1': { itemId: 'wisp-feather', itemQuantity: 2, gold: 35, xp: 60 } },
  'sky-bridge': { 'chest-sky-bridge-1': { itemId: 'prairie-wolf-pelt', itemQuantity: 2, gold: 35, xp: 60 } },
  'storm-galleries': { 'chest-storm-galleries-1': { itemId: 'greater-healing-poultice', gold: 35, xp: 60 } },
  'guardian-peak': { 'chest-guardian-peak-1': { itemId: 'greater-spirit-draught', gold: 35, xp: 60 } },
  'root-caverns': { 'chest-root-caverns-1': { itemId: 'withered-echo-moss', itemQuantity: 2, gold: 40, xp: 75 } },
  'inner-archive': { 'chest-inner-archive-1': { itemId: 'gnarled-root-fiber', itemQuantity: 2, gold: 40, xp: 75 } },
  'guardian-grove': { 'chest-guardian-grove-1': { itemId: 'superior-healing-poultice', gold: 40, xp: 75 } },
  'inner-observatory': { 'chest-inner-observatory-1': { itemId: 'starlight-dust', itemQuantity: 2, gold: 50, xp: 95 } },
  'star-chamber': { 'chest-star-chamber-1': { itemId: 'sandglass-shard', itemQuantity: 2, gold: 50, xp: 95 } },
  'canyon-depths': { 'chest-canyon-depths-1': { itemId: 'superior-spirit-draught', gold: 50, xp: 95 } },
  'guardian-summit': { 'chest-guardian-summit-1': { itemId: 'superior-healing-poultice', gold: 50, xp: 95 } },
  'hall-of-eternal-winter': { 'chest-hall-of-eternal-winter-1': { itemId: 'frozen-essence', itemQuantity: 2, gold: 55, xp: 105 } },
  'guardian-chamber': { 'chest-guardian-chamber-1': { itemId: 'frost-wolf-fang', itemQuantity: 2, gold: 55, xp: 105 } },
  // The very last chest in the game - Mythic-tier consumable as a send-off before the final boss.
  'summit-of-winter': { 'chest-summit-of-winter-1': { itemId: 'pristine-healing-poultice', gold: 55, xp: 105 } },
};

export const openChest = onCall<OpenChestRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const { locationId, chestId } = request.data ?? {};
  const reward = locationId && chestId ? CHESTS[locationId]?.[chestId] : undefined;
  if (!reward) throw new HttpsError('invalid-argument', 'There is no chest here.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    if (save.player.currentLocationId !== locationId) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }

    const openedChests = save.openedChests ?? [];

    if (openedChests.includes(chestId)) {
      return { alreadyOpened: true, itemId: reward.itemId };
    }

    // A unique item already owned some other way (quest reward, etc.) - still mark the chest
    // opened and still grant the gold/xp, just skip the item itself.
    grantItem(save, reward.itemId, reward.itemQuantity ?? 1);
    save.player.gold += reward.gold;
    save.player.xp += reward.xp;
    applyLevelUp(save);

    save.openedChests = [...openedChests, chestId];
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return {
      alreadyOpened: false,
      itemId: reward.itemId,
      itemQuantity: reward.itemQuantity ?? 1,
      gold: reward.gold,
      xp: reward.xp,
    };
  });
});
