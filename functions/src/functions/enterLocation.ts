import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
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
