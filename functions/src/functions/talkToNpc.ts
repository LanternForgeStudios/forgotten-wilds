import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards, currentNpcDialogueVariantKey, isEmptyQuestRewardSummary } from '../engine/questEngine';
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
  // Whispering Pines (MSQ Volume IV, Chapter 7) - added at the same time the NPCs themselves were
  // authored this time, learning from the Endless Prairie gap above.
  'elder-rowan-birch': 'cedarwatch-elders-lodge',
  'archivist-elowen': 'cedarwatch-great-tree-library',
  'forest-warden-rowan-hart': 'cedarwatch',
  'cedar-spirit': 'ancient-cedar-shrine',
  'innkeeper-marge': 'cedarwatch-inn',
  'storekeeper-byron': 'cedarwatch-general-store',
  'blacksmith-dara': 'cedarwatch-blacksmith',
  'armorer-fenn': 'cedarwatch-armory',
  // Shattered Desert (MSQ Volume V, Chapter 9) - added at the same time the NPCs themselves were
  // authored, same discipline as Whispering Pines above.
  'elder-santiago-ortega': 'red-mesa-elders-hall',
  'scholar-nia-solis': 'red-mesa-relic-museum',
  'desert-ranger-tomas-vega': 'red-mesa',
  'sand-spirit': 'celestial-oasis',
  'innkeeper-rosa': 'red-mesa-inn',
  'storekeeper-mateo': 'red-mesa-general-store',
  'blacksmith-esteban': 'red-mesa-blacksmith',
  'armorer-carmen': 'red-mesa-armory',
  // Frozen Frontier (MSQ Volume VI, Chapter 11) - added at the same time the NPCs themselves were
  // authored, same discipline as every region since Whispering Pines.
  'elder-henrik': 'frosthaven-explorer-headquarters',
  'captain-astrid-frost': 'frosthaven',
  'aurora-keeper-lyra': 'frosthaven-ice-chapel',
  'winter-spirit': 'aurora-basin',
  'innkeeper-greta': 'frosthaven-inn',
  'storekeeper-bjorn': 'frosthaven-general-store',
  'blacksmith-sigrid': 'frosthaven-blacksmith',
  'armorer-magnus': 'frosthaven-armory',
};
const KNOWN_NPC_IDS = new Set(Object.keys(NPC_LOCATIONS));

export const talkToNpc = onCall<TalkToNpcRequest>({ enforceAppCheck: true }, async (request) => {
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

    const completions = advanceQuests(save.quests, { type: 'talkToNpc', targetId: npcId });
    const questRewards = applyQuestRewards(save, completions);

    // A "report back" key (shape `${questId}:${objectiveId}`) is guaranteed to stop being current
    // the instant this exact call credits its objective above - it can never be shown again for
    // this npc/quest pair, so recording it as "seen" would leave the "!" badge with nothing it
    // could ever match against, making it reappear immediately even though the player was just
    // there and saw everything this conversation had to say. Record what's actually current *after*
    // advancing instead, for this case only - the ordinary (non-report) case still records the
    // pre-credit key, so a genuine "you haven't read the reaction to what you just completed" badge
    // is preserved rather than silently marked seen before the player ever saw it.
    const keyToRecordAsSeen = shownVariantKey.includes(':') ? currentNpcDialogueVariantKey(npcId, save.quests) : shownVariantKey;
    save.seenNpcDialogueVariant = { ...(save.seenNpcDialogueVariant ?? {}), [npcId]: keyToRecordAsSeen };
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return {
      questsCompleted: completions.map((c) => c.questId),
      questRewards: isEmptyQuestRewardSummary(questRewards) ? null : questRewards,
    };
  });
});
