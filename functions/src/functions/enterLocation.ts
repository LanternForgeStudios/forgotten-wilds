import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import type { PlayerSave } from '../shared-types';

interface EnterLocationRequest {
  locationId: string;
}

const KNOWN_LOCATION_IDS = new Set(['ash-hallow', 'ironwood-trail', 'hollow-rail-mine']);

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
