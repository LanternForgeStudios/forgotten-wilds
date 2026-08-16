/**
 * Shared setup for Cloud-Function-level tests - the ones that exercise a real onCall handler's
 * Firestore transaction, not just the pure engine functions (functions/src/engine/*.test.ts
 * already covers those without needing any of this). Always talks to the Firestore/Auth
 * EMULATORS, never production - the emulator host/port are hardcoded (matching /run_local's own
 * ports) rather than read from the environment, specifically so a test run can never be pointed
 * at the real project by accident.
 *
 * Requires the Firestore emulator to already be running (`/run_local start`, or
 * `npx firebase-tools emulators:start --only auth,firestore,functions`) - resetFirestore() below
 * fails fast with a clear message if it isn't, rather than letting individual tests hang.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildFreshPlayer, buildFreshSaveContent } from '../engine/newCharacter';
import type { PlayerSave } from '../shared-types';

const EMULATOR_HOST = '127.0.0.1:8080';
const EMULATOR_PROJECT_ID = 'forgotten-wilds';

process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = EMULATOR_PROJECT_ID;

// Every test file that imports this module shares one admin app - re-initializing on a second
// import (vitest can load this module more than once across test files in the same worker) would
// throw "app already exists".
if (getApps().length === 0) {
  initializeApp({ projectId: EMULATOR_PROJECT_ID });
}

/** Wipes every document in the emulator's Firestore instance - call in a beforeEach so one test's
 *  writes never leak into the next. Uses the emulator's own REST clear-data endpoint (there's no
 *  Admin SDK method for "delete everything"). Fails fast with a clear message (rather than each
 *  test in the file timing out separately trying to read/write a Firestore that isn't there) if
 *  the emulator isn't reachable at all. */
export async function resetFirestore(): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`http://${EMULATOR_HOST}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`, {
      method: 'DELETE',
    });
  } catch {
    throw new Error(
      `Could not reach the Firestore emulator at ${EMULATOR_HOST}. These tests need it running first - ` +
        `see /run_local start (or npx firebase-tools emulators:start --only auth,firestore,functions).`,
    );
  }
  if (!res.ok) {
    throw new Error(`Failed to reset emulator Firestore: ${res.status} ${await res.text()}`);
  }
}

/** A brand-new character's exact starting PlayerSave (same shape createCharacter.ts produces),
 *  for a test to seed and then mutate before writing - mirrors resetPlayerProgress.ts's own
 *  construction so tests exercise the real starting shape, not a hand-rolled approximation that
 *  could drift from it. */
export function freshTestSave(uid: string, name = 'Test Hero'): PlayerSave {
  const now = Date.now();
  const player = buildFreshPlayer(uid, name, now);
  return {
    displayName: name,
    createdAt: now,
    lastLoginAt: now,
    player,
    ...buildFreshSaveContent(),
    updatedAt: now,
  };
}

/** Builds a fresh save (optionally mutated first) and writes it to `users/{uid}` in the emulator,
 *  returning the exact save that was written so the test can assert against its own baseline
 *  values (starting stats, etc.) instead of hardcoding them a second time. */
export async function seedPlayer(uid: string, mutate?: (save: PlayerSave) => void): Promise<PlayerSave> {
  const save = freshTestSave(uid);
  mutate?.(save);
  await getFirestore().collection('users').doc(uid).set(save);
  return save;
}

/** Reads back whatever's currently stored for a uid - for asserting the Cloud Function's
 *  transaction actually persisted, not just that it returned the right response. */
export async function readPlayer(uid: string): Promise<PlayerSave> {
  const snap = await getFirestore().collection('users').doc(uid).get();
  if (!snap.exists) throw new Error(`No player doc for uid "${uid}"`);
  return snap.data() as PlayerSave;
}

/** Invokes an onCall Cloud Function the way `.run()` is designed for (see firebase-functions'
 *  own CallableFunction.run doc comment: "Used for unit testing") - as a signed-in `uid` with the
 *  given request body, skipping all the HTTP/App Check plumbing a real client call goes through. */
export function callAs<Req, Res>(fn: { run(request: { data: Req; auth: unknown }): Res }, uid: string, data: Req): Res {
  return fn.run({ data, auth: { uid, token: { uid } } });
}
