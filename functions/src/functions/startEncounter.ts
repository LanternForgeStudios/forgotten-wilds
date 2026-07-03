import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { rollEnemyForLocation } from '../engine/combatEngine';
import { ENEMIES } from '../data/enemies';
import { effectiveStatus } from '../engine/questEngine';
import type { CombatSession, PlayerSave } from '../shared-types';

interface StartEncounterRequest {
  locationId: string;
  /** Set only for deliberate boss encounters triggered from a dungeon's boss interactable. */
  bossId?: string;
}

/** Which quest must be completed before a given boss can be challenged. */
const BOSS_PREREQUISITE_QUEST: Record<string, string> = {
  'coalbound-warden': 'the-miners-lantern',
};

export const startEncounter = onCall<StartEncounterRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to fight.');
  }

  const locationId = request.data?.locationId;
  if (typeof locationId !== 'string') {
    throw new HttpsError('invalid-argument', 'locationId is required.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError('failed-precondition', 'No character found for this account.');
  }
  const save = userSnap.data() as PlayerSave;

  let enemy;
  const bossId = request.data?.bossId;
  if (bossId) {
    const prerequisite = BOSS_PREREQUISITE_QUEST[bossId];
    const questsDone = !prerequisite || effectiveStatus(prerequisite, save.quests) === 'completed';
    if (!ENEMIES[bossId]?.isBoss || !questsDone) {
      throw new HttpsError('failed-precondition', 'That boss cannot be challenged yet.');
    }
    enemy = ENEMIES[bossId];
  } else {
    try {
      enemy = rollEnemyForLocation(locationId);
    } catch {
      throw new HttpsError('invalid-argument', `No enemies are known to roam "${locationId}".`);
    }
  }

  const now = Date.now();
  const session: CombatSession = {
    sessionId: db.collection('combatSessions').doc().id,
    uid,
    locationId,
    enemyId: enemy.id,
    enemyHp: enemy.stats.maxHp,
    enemyMaxHp: enemy.stats.maxHp,
    round: 1,
    status: 'active',
    startedAt: now,
    expiresAt: now + 30 * 60 * 1000,
  };
  await db.collection('combatSessions').doc(uid).set(session);

  return {
    sessionId: session.sessionId,
    enemyId: enemy.id,
    enemyName: enemy.name,
    enemyHp: enemy.stats.maxHp,
    enemyMaxHp: enemy.stats.maxHp,
    playerHp: save.player.stats.hp,
    playerMaxHp: save.player.stats.maxHp,
    playerSpirit: save.player.stats.spirit,
    playerMaxSpirit: save.player.stats.maxSpirit,
  };
});
