import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import type { PlayerSave } from '../shared-types';

interface VisitLandmarkRequest {
  landmarkId: string;
}

/** Landmarks are sub-areas within a larger overworld map (e.g. Spirit Grove within Ironwood
 *  Trail) - visiting one records Journal coverage and advances quests the same way arriving at a
 *  full location would, but does NOT change `player.currentLocationId` since the player never
 *  actually left the parent map. */
/** Which parent map's location each landmark lives within - used to confirm the player is
 *  actually there before granting anything, the same way enterLocation.ts/collectWorldItem.ts do. */
const LANDMARK_PARENT_LOCATION: Record<string, string> = {
  'hunters-camp': 'ironwood-trail',
  'spirit-grove': 'ironwood-trail',
  'mossy-creek': 'ironwood-trail',
  'fallen-watchtower': 'ironwood-trail',
};
const KNOWN_LANDMARK_IDS = new Set(Object.keys(LANDMARK_PARENT_LOCATION));

export const visitLandmark = onCall<VisitLandmarkRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const landmarkId = request.data?.landmarkId;
  if (typeof landmarkId !== 'string' || !KNOWN_LANDMARK_IDS.has(landmarkId)) {
    throw new HttpsError('invalid-argument', 'Unknown landmark.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    if (save.player.currentLocationId !== LANDMARK_PARENT_LOCATION[landmarkId]) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }

    const alreadyVisited = save.journal.locationsVisited.includes(landmarkId);
    if (!alreadyVisited) {
      save.journal.locationsVisited.push(landmarkId);
    }

    const completions = advanceQuests(save.quests, { type: 'reachLocation', targetId: landmarkId });
    applyQuestRewards(save, completions);
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { alreadyVisited, questsCompleted: completions.map((c) => c.questId) };
  });
});
