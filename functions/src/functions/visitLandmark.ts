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
const KNOWN_LANDMARK_IDS = new Set(['hunters-camp', 'spirit-grove', 'mossy-creek', 'fallen-watchtower']);

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
