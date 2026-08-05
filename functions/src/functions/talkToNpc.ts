import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards, currentNpcDialogueVariantKey } from '../engine/questEngine';
import { backfillPlayerEquipment } from '../engine/equipmentEngine';
import type { PlayerSave } from '../shared-types';

interface TalkToNpcRequest {
  npcId: string;
}

// Which location each NPC is actually physically placed in (matches the `npc` map object each
// one's location JSON carries - see src/data/locations.ts's own npcIds for the broader per-town
// roster list, which isn't precise enough for this: it groups a shopkeeper under both their
// building interior *and* the town square as a whole). Server-side source of truth for the
// currentLocationId check below, the same pattern every sibling landmark function
// (visitLandmark.ts/interactWithShrine.ts/collectWorldItem.ts) already validates against - talkToNpc
// was the one interaction that skipped it, letting a quest's talkToNpc objective be completed from
// anywhere without ever traveling to the NPC.
const NPC_LOCATIONS: Record<string, string> = {
  'elias-rowan': 'ash-hallow-elias-house',
  'finn-rowan': 'ash-hallow-elias-house',
  'mara-ash': 'ash-hallow-mara-shop',
  'silas-flint': 'ash-hallow-mine-office',
  'juniper-reed': 'ash-hallow-inn',
  'nell-ashby': 'ash-hallow',
  'aldren-stone': 'ash-hallow-blacksmith',
  'tessa-ironhand': 'ash-hallow-armory',
  'willow-briar': 'ash-hallow-apothecary',
  'historian-miriam': 'ash-hallow-archive',
  'mayor-eleanor-ashcroft': 'ash-hallow-town-hall',
  'hunter-garrick': 'ironwood-trail',
  'spirit-child': 'ironwood-trail',
  'ranger-caleb': 'raven-ridge',
  'mayor-celeste-broussard': 'mirehaven-town-hall',
  'lucien-boudreaux': 'mirehaven-archive',
  'marsh-spirit': 'cypress-marsh',
  'sabine-thorne': 'hidden-river-landing',
  'innkeep-odette': 'mirehaven-inn',
  'merchant-remy': 'mirehaven-general-store',
  'blacksmith-toussaint': 'mirehaven-blacksmith',
  'armorer-delphine': 'mirehaven-armory',
  'herbalist-noelle': 'mirehaven-herbalist',
  // Endless Prairie (MSQ Volume III, Chapters 5-6) - these were missing entirely, which meant
  // every talkToNpc call for any of them threw "Unknown NPC" server-side even though the client
  // opened the dialogue box anyway (setActiveNpc happens before the callTalkToNpc promise
  // resolves, and the failure is only console.error'd) - quest talkToNpc objectives for this
  // whole region silently never completed.
  'chief-aiyana-whitefeather': 'highwind-crossing-chiefs-lodge',
  'elder-koda-running-elk': 'highwind-crossing-spirit-lodge',
  'scout-niska': 'highwind-crossing',
  'prairie-spirit': 'sacred-hills',
  'innkeeper-hattie': 'highwind-crossing-inn',
  'storekeeper-wyatt': 'highwind-crossing-general-store',
  'blacksmith-garrett': 'highwind-crossing-blacksmith',
  'armorer-ruth': 'highwind-crossing-armory',
};
const KNOWN_NPC_IDS = new Set(Object.keys(NPC_LOCATIONS));

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
    backfillPlayerEquipment(save);

    if (save.player.currentLocationId !== NPC_LOCATIONS[npcId]) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }

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
