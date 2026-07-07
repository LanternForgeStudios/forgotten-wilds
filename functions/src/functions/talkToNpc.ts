import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards, currentNpcDialogueVariantKey } from '../engine/questEngine';
import type { PlayerSave } from '../shared-types';

interface TalkToNpcRequest {
  npcId: string;
}

const KNOWN_NPC_IDS = new Set([
  'elias-rowan',
  'finn-rowan',
  'mara-ash',
  'silas-flint',
  'juniper-reed',
  'nell-ashby',
  'aldren-stone',
  'tessa-ironhand',
  'willow-briar',
  'historian-miriam',
  'mayor-eleanor-ashcroft',
  'hunter-garrick',
  'spirit-child',
  'ranger-caleb',
]);

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

    // Computed *before* advancing quests below, so this reflects the variant the player actually
    // saw this visit (the client's DialogueBox renders off quest state captured at dialogue-open
    // time, before the post-talk resync) - not whatever variant this same conversation might have
    // just unlocked.
    const shownVariantKey = currentNpcDialogueVariantKey(npcId, save.quests);
    save.seenNpcDialogueVariant = { ...(save.seenNpcDialogueVariant ?? {}), [npcId]: shownVariantKey };

    const completions = advanceQuests(save.quests, { type: 'talkToNpc', targetId: npcId });
    applyQuestRewards(save, completions);
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { questsCompleted: completions.map((c) => c.questId) };
  });
});
