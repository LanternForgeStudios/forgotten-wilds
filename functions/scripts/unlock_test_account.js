/**
 * Local-only dev tool: marks every region-entry quest gate as completed on a test account, so
 * enterLocation.ts's LOCATION_GATES check ("The way isn't open to you yet.") never blocks travel
 * for that account, and unlocks Dash (normally gated on the Guardian of Ironwood quest chain via
 * interactWithShrine.ts - dash.ts itself just checks stats.maxStamina > 0). Also marks every
 * location in the game as "visited" (journal.locationsVisited) - JournalOfLegends.tsx's fast-travel
 * list only ever offers a location once it's in that array, so an account that jumped straight to
 * "every region is walkable" without ever actually walking anywhere would still have an empty fast-
 * travel list otherwise. Exists for map-editing QA - walking/warping into every region, at full
 * movement speed, without grinding the main quest line first.
 *
 * Always talks to the Firestore/Auth EMULATORS, never production - the *_EMULATOR_HOST env vars
 * are hardcoded to the local emulator addresses below (see .claude/skills/run_local's own ports)
 * rather than read from the environment, specifically so this can never be pointed at the real
 * project by accident.
 *
 * Usage (from functions/, with the local emulator suite already running - see /run_local start):
 *   node scripts/unlock_test_account.js [email] [password]
 * Defaults to maptester@local.test / testpass123 if omitted.
 *
 * The account's character must already exist (create it once through the game's normal sign-up +
 * character-creation screen while pointed at the local emulator) - this script only patches an
 * existing save's `quests` field, it doesn't build a fresh PlayerSave itself (that shape lives in
 * functions/src/engine/newCharacter.ts and shouldn't be duplicated here).
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// Reads the client's own src/data/locations.ts directly rather than hand-duplicating its ~100 ids
// here (this is a local-only dev script that never gets deployed, so reaching across into src/ at
// dev-time doesn't hit the "functions/ zips separately" concern CLAUDE.md documents for actual
// deployed code) - always exactly in sync with whatever locations currently exist, including any
// added since this script was last touched.
function allLocationIds() {
  const src = fs.readFileSync(path.join(__dirname, '../../src/data/locations.ts'), 'utf8');
  return [...src.matchAll(/^\s*id:\s*'([a-z0-9-]+)',$/gm)].map((m) => m[1]);
}

// Mirrors functions/src/functions/enterLocation.ts's own LOCATION_GATES values (deduplicated) -
// kept in sync by hand, same convention that file's own comment already documents against
// src/utils/locationGates.ts.
const GATE_QUEST_IDS = [
  'the-first-flame',
  'the-forgotten-shrine',
  'shadows-on-raven-ridge',
  'the-mountain-remembers',
  'beneath-still-waters',
  'the-waters-remember',
  'the-stone-circles',
  'climbing-thunderbird-mesa',
  'the-first-promise-remembered',
  'heartwood-sanctuary',
  'the-missing-pages',
  'the-path-of-the-astronomers',
  'the-stars-never-lied',
  'hall-of-eternal-winter',
];

// Mirrors functions/src/data/leveling.ts's own constants - kept in sync by hand, same convention
// as GATE_QUEST_IDS above. interactWithShrine.ts computes the real unlock the same way: base pool
// plus per-level growth, so someone already past level 1 doesn't end up under-sized.
const BASE_STAMINA_ON_UNLOCK = 40;
const STAMINA_GROWTH_PER_LEVEL = 5;

async function main() {
  const email = process.argv[2] || 'maptester@local.test';
  const password = process.argv[3] || 'testpass123';

  admin.initializeApp({ projectId: 'forgotten-wilds' });
  const auth = getAuth();
  const db = getFirestore();

  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Found existing auth user ${user.uid} (${email}).`);
  } catch {
    user = await auth.createUser({ email, password, emailVerified: true, displayName: 'Map Tester' });
    console.log(`Created auth user ${user.uid} (${email} / ${password}).`);
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
  for (const questId of GATE_QUEST_IDS) {
    const existing = save.quests[questId];
    save.quests[questId] = { status: 'completed', objectiveCounts: existing?.objectiveCounts ?? {} };
  }

  save.journal = save.journal || {};
  const locationIds = allLocationIds();
  const alreadyVisited = new Set(save.journal.locationsVisited ?? []);
  save.journal.locationsVisited = [...new Set([...alreadyVisited, ...locationIds])];

  const level = save.player.level || 1;
  const maxStamina = BASE_STAMINA_ON_UNLOCK + STAMINA_GROWTH_PER_LEVEL * (level - 1);
  save.player.stats.maxStamina = maxStamina;
  save.player.stats.stamina = maxStamina;
  save.player.staminaUpdatedAt = Date.now();

  save.updatedAt = Date.now();
  await userRef.set(save);

  console.log(`Marked ${GATE_QUEST_IDS.length} region-gate quests completed for ${email} (uid ${user.uid}).`);
  console.log('Every region entry point in LOCATION_GATES is now reachable for this account.');
  console.log(`Dash unlocked (maxStamina=${maxStamina} at level ${level}).`);
  console.log(`Marked all ${locationIds.length} locations visited - every one is now available in the fast-travel list.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
