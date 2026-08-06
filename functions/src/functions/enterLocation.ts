import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import { backfillPlayerEquipment } from '../engine/equipmentEngine';
import type { PlayerSave } from '../shared-types';

interface EnterLocationRequest {
  locationId: string;
}

/** Which completed quest unlocks travel into a given region - authoritative enforcement (a
 *  modified client can't skip this even if it also bypasses the client-side check in
 *  useLocationExploration.ts). Kept in sync by hand with src/utils/locationGates.ts. */
const LOCATION_GATES: Record<string, string> = {
  'ironwood-trail': 'the-first-flame',
  'raven-ridge': 'the-forgotten-shrine',
  'whisper-falls': 'the-forgotten-shrine',
  'hollow-rail-mine': 'shadows-on-raven-ridge',
  // Crimson Bayou is unlocked entirely by Iron Mountains' own finale (MSF-IM-012) - the same
  // single-gate-per-region-entry-point model as Iron Mountains' own 'ironwood-trail', not a
  // separate gate per field map (MSF-CB-002 sends the player to all three in any order).
  mirehaven: 'the-mountain-remembers',
  'cypress-marsh': 'the-mountain-remembers',
  'murkwater-trails': 'the-mountain-remembers',
  'hidden-river-landing': 'the-mountain-remembers',
  // Chapter 4's dungeon - gated on the last Chapter 3 quest (beneath-still-waters), the same
  // "latest quest safely completed *before* the location is ever needed" rule
  // src/utils/locationGates.ts's own comment documents (into-the-deep-current's own first
  // objective is reaching this location, so gating on it directly would be circular).
  'temple-of-the-deep-current': 'beneath-still-waters',
  // Endless Prairie (MSQ Volume III) - same single-gate-per-region-entry-point model as Crimson
  // Bayou above, gated on Bayou's own finale. Was missing entirely until Chapter 6's build found
  // it - Chapter 5 shipped without ever adding Prairie to this file, a real gap (not yet visible
  // since nothing links Highwind Crossing into the reachable world yet).
  'highwind-crossing': 'the-waters-remember',
  // Chapter 6's dungeon hand-off, same "latest quest safely completed before this location is
  // needed" rule - climbing-thunderbird-mesa's own first objective is reaching
  // thunderbird-mesa-approach, so gating on it directly would be circular; the-stone-circles is
  // the quest immediately before it.
  'thunderbird-mesa-approach': 'the-stone-circles',
  // Thunderbird Mesa dungeon entrance - gated on Chapter 5's true finale. The other 4 rooms
  // (sky-bridge/storm-galleries/lantern-sanctuary/guardian-peak) are reached by physically walking
  // the chained transitions from here, matching temple-of-the-deep-current's own single-gate
  // dungeon precedent - no separate gate needed per room.
  'summit-temple': 'climbing-thunderbird-mesa',
  // Whispering Pines (MSQ Volume IV) - same single-gate-per-region-entry-point model, gated on
  // Volume III's own true finale.
  'cedarwatch': 'the-first-promise-remembered',
  // Heartwood Sanctuary dungeon entrance (Chapter 8) - gated on Chapter 7's true finale. The other
  // 3 rooms (inner-archive/heartwood-lantern-sanctuary/guardian-grove) are reached by physically
  // walking the chained transitions from here, same single-gate dungeon precedent as Summit Temple.
  'root-caverns': 'heartwood-sanctuary',
  // Shattered Desert (MSQ Volume V) - same single-gate-per-region-entry-point model, gated on
  // Volume IV's own true finale.
  'red-mesa': 'the-missing-pages',
  // Forgotten Observatory dungeon entrance (Chapter 10) - gated on Chapter 9's true finale. The
  // other 4 rooms (star-chamber/star-lantern-sanctuary/canyon-depths/guardian-summit) are reached
  // by physically walking the chained transitions from here, same single-gate dungeon precedent.
  'inner-observatory': 'the-path-of-the-astronomers',
};

const KNOWN_LOCATION_IDS = new Set([
  'ash-hallow',
  'ironwood-trail',
  'raven-ridge',
  'whisper-falls',
  'black-briar-forest',
  'hollow-rail-mine',
  'ash-hallow-elias-house',
  'ash-hallow-mara-shop',
  'ash-hallow-inn',
  'ash-hallow-blacksmith',
  'ash-hallow-apothecary',
  'ash-hallow-armory',
  'ash-hallow-archive',
  'ash-hallow-mine-office',
  'ash-hallow-town-hall',
  'mirehaven',
  'cypress-marsh',
  'murkwater-trails',
  'hidden-river-landing',
  'mirehaven-town-hall',
  'mirehaven-archive',
  'mirehaven-inn',
  'mirehaven-general-store',
  'mirehaven-blacksmith',
  'mirehaven-armory',
  'mirehaven-herbalist',
  'temple-of-the-deep-current',
  // Endless Prairie (MSQ Volume III) - all 13 Chapter 5 locations, missing until Chapter 6's build
  // found the gap (see LOCATION_GATES comment above).
  'highwind-crossing',
  'golden-prairie',
  'spirit-herd-plains',
  'sacred-hills',
  'stone-circle-valley',
  'thunderbird-mesa-approach',
  'highwind-crossing-chiefs-lodge',
  'highwind-crossing-spirit-lodge',
  'highwind-crossing-inn',
  'highwind-crossing-general-store',
  'highwind-crossing-blacksmith',
  'highwind-crossing-armory',
  // stone-circle-carvings deliberately absent - a shrine-kind landmark reached via
  // interactWithShrine.ts, which never calls enterLocation or changes currentLocationId, same as
  // mother-cypress-shrine's own precedent above (also absent from this set).
  // Chapter 6's Thunderbird Mesa dungeon (5 chained rooms).
  'summit-temple',
  'sky-bridge',
  'storm-galleries',
  'lantern-sanctuary',
  'guardian-peak',
  // Whispering Pines (MSQ Volume IV, Chapter 7).
  'cedarwatch',
  'mistwood-path',
  'elder-forest',
  'silver-river',
  'ancient-cedar-shrine',
  'heartwood-approach',
  'cedarwatch-elders-lodge',
  'cedarwatch-great-tree-library',
  'cedarwatch-inn',
  'cedarwatch-general-store',
  'cedarwatch-blacksmith',
  'cedarwatch-armory',
  // Chapter 8's Heartwood Sanctuary dungeon (4 chained rooms).
  'root-caverns',
  'inner-archive',
  'heartwood-lantern-sanctuary',
  'guardian-grove',
  // Shattered Desert (MSQ Volume V, Chapter 9).
  'red-mesa',
  'sunfire-dunes',
  'crimson-canyons',
  'painted-mesas',
  'celestial-oasis',
  'forgotten-observatory-approach',
  'red-mesa-elders-hall',
  'red-mesa-relic-museum',
  'red-mesa-inn',
  'red-mesa-general-store',
  'red-mesa-blacksmith',
  'red-mesa-armory',
  // Chapter 10's Forgotten Observatory dungeon (5 chained rooms).
  'inner-observatory',
  'star-chamber',
  'star-lantern-sanctuary',
  'canyon-depths',
  'guardian-summit',
]);

export const enterLocation = onCall<EnterLocationRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const locationId = request.data?.locationId;
  if (typeof locationId !== 'string' || !KNOWN_LOCATION_IDS.has(locationId)) {
    throw new HttpsError('invalid-argument', 'Unknown location.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;
    backfillPlayerEquipment(save);

    const requiredQuestId = LOCATION_GATES[locationId];
    if (requiredQuestId && save.quests[requiredQuestId]?.status !== 'completed') {
      throw new HttpsError('failed-precondition', "The way isn't open to you yet.");
    }

    save.player.currentLocationId = locationId;
    if (!save.journal.locationsVisited.includes(locationId)) {
      save.journal.locationsVisited.push(locationId);
    }

    const completions = advanceQuests(save.quests, { type: 'reachLocation', targetId: locationId });
    applyQuestRewards(save, completions);
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { questsCompleted: completions.map((c) => c.questId) };
  });
});
