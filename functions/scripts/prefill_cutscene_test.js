/**
 * Local-only dev tool: prefills a test account's quest state so a single quest-completion
 * cutscene (see src/data/cutscenes.ts's QUEST_COMPLETION_CUTSCENES) can be triggered by
 * completing just its final objective live in-game, instead of replaying the whole story up to
 * that point.
 *
 * Marks the target quest's own prerequisite as completed, and every objective except the LAST
 * one in its definition order as already satisfied via a direct Firestore write. The last
 * objective is always the quest's real "report back" or "witness the shrine" beat - a talkToNpc
 * or interactWithShrine type, which (unlike collectItem/reachLocation) has no persistent
 * "already did this" record for reconcileRetroactiveObjectives to auto-satisfy (see that
 * function's own comment in functions/src/engine/questEngine.ts). Leaving it unfilled means the
 * player has to walk up and trigger it for real, through the actual Cloud Function, so
 * hydrate.ts observes a genuine 'active' -> 'completed' transition and fires the real cutscene -
 * a raw force-write of status:'completed' (see unlock_test_account.js) would skip that
 * transition entirely and never fire it.
 *
 * Reads objectives from the COMPILED functions/lib/data/quests.js, not the .ts source - run
 * `npm run build` first if you've just added/edited a quest.
 *
 * Always talks to the Firestore/Auth EMULATORS, never production - same hardcoded-host
 * convention as unlock_test_account.js, so this can never touch the real project by accident.
 *
 * Usage (from functions/, with the local emulator suite already running - see /run_local start):
 *   node scripts/prefill_cutscene_test.js <questId> [email]
 * Defaults email to test2@test.com. The account's character must already exist.
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { QUESTS } = require('../lib/data/quests');

async function main() {
  const questId = process.argv[2];
  const email = process.argv[3] || 'test2@test.com';

  if (!questId) {
    console.error('Usage: node scripts/prefill_cutscene_test.js <questId> [email]');
    process.exitCode = 1;
    return;
  }

  const def = QUESTS[questId];
  if (!def) {
    console.error(
      `No quest def found for id "${questId}" in the compiled data. Check functions/src/data/quests.ts ` +
        `and run "npm run build" first if you just added it.`,
    );
    process.exitCode = 1;
    return;
  }

  admin.initializeApp({ projectId: 'forgotten-wilds' });
  const auth = getAuth();
  const db = getFirestore();

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(`No auth user found for ${email}. Create the account/character through the game first.`);
    process.exitCode = 1;
    return;
  }

  const userRef = db.collection('users').doc(user.uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    console.error(
      `No character found for ${email} yet. Sign in with this account in the game (local emulator) and ` +
        `create a character first, then re-run this script.`,
    );
    process.exitCode = 1;
    return;
  }

  const save = snap.data();
  save.quests = save.quests || {};

  if (def.prerequisiteQuestId) {
    const existing = save.quests[def.prerequisiteQuestId];
    save.quests[def.prerequisiteQuestId] = { status: 'completed', objectiveCounts: existing?.objectiveCounts ?? {} };
  }

  const finalObjective = def.objectives[def.objectives.length - 1];
  const objectiveCounts = {};
  for (const o of def.objectives) {
    if (o.id === finalObjective.id) continue;
    objectiveCounts[o.id] = o.requiredCount;
  }
  save.quests[questId] = { status: 'active', objectiveCounts };

  save.updatedAt = Date.now();
  await userRef.set(save);

  console.log(`Prefilled "${questId}" for ${email} (uid ${user.uid}):`);
  if (def.prerequisiteQuestId) console.log(`  - prerequisite "${def.prerequisiteQuestId}" marked completed`);
  console.log(`  - every objective except "${finalObjective.id}" pre-satisfied`);
  console.log(
    `  - final objective left open: "${finalObjective.id}" (${finalObjective.type} -> ${finalObjective.targetId})`,
  );
  console.log(`Log in as ${email} and trigger that objective live in-game to fire the real cutscene.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
