import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { rollEncounterGroup, rollEnemyLevel, scaledEnemyStats, BOSS_LEVEL } from '../engine/combatEngine';
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
  'coalbound-warden': 'the-shrine-below',
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

  let enemies;
  const bossId = request.data?.bossId;
  if (bossId) {
    const prerequisite = BOSS_PREREQUISITE_QUEST[bossId];
    const questsDone = !prerequisite || effectiveStatus(prerequisite, save.quests) === 'completed';
    if (!ENEMIES[bossId]?.isBoss || !questsDone) {
      throw new HttpsError('failed-precondition', 'That boss cannot be challenged yet.');
    }
    // Bosses are always a single scripted fight, never grouped with trash mobs.
    enemies = [ENEMIES[bossId]];
  } else {
    try {
      enemies = rollEncounterGroup(locationId, save.player.level);
    } catch {
      throw new HttpsError('invalid-argument', `No enemies are known to roam "${locationId}".`);
    }
  }

  const rolledLevels = bossId
    ? [BOSS_LEVEL]
    : enemies.map((e) => rollEnemyLevel(save.player.level, e));
  const rolledStats = enemies.map((e, i) => scaledEnemyStats(e, rolledLevels[i]));

  const now = Date.now();
  const session: CombatSession = {
    sessionId: db.collection('combatSessions').doc().id,
    uid,
    locationId,
    enemies: enemies.map((e, i) => ({
      enemyId: e.id,
      level: rolledLevels[i],
      hp: rolledStats[i].maxHp,
      maxHp: rolledStats[i].maxHp,
    })),
    round: 1,
    status: 'active',
    startedAt: now,
    expiresAt: now + 30 * 60 * 1000,
  };
  await db.collection('combatSessions').doc(uid).set(session);

  return {
    sessionId: session.sessionId,
    enemies: enemies.map((e, index) => ({
      index,
      enemyId: e.id,
      name: e.name,
      tier: e.tier,
      level: rolledLevels[index],
      hp: rolledStats[index].maxHp,
      maxHp: rolledStats[index].maxHp,
      isBoss: e.isBoss,
    })),
    playerHp: save.player.stats.hp,
    playerMaxHp: save.player.stats.maxHp,
    playerSpirit: save.player.stats.spirit,
    playerMaxSpirit: save.player.stats.maxSpirit,
  };
});
