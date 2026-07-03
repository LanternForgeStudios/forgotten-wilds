import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import type { PlayerSave } from '../shared-types';

interface TalkToNpcRequest {
  npcId: string;
}

const KNOWN_NPC_IDS = new Set(['elias-rowan', 'mara-vale', 'silas-flint', 'juniper-reed', 'nell-ashby']);

export const talkToNpc = onCall<TalkToNpcRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const npcId = request.data?.npcId;
  if (typeof npcId !== 'string' || !KNOWN_NPC_IDS.has(npcId)) {
    throw new HttpsError('invalid-argument', 'Unknown NPC.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    const completions = advanceQuests(save.quests, { type: 'talkToNpc', targetId: npcId });
    applyQuestRewards(save, completions);
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { questsCompleted: completions.map((c) => c.questId) };
  });
});
