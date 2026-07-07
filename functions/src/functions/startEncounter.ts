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

  if (save.player.currentLocationId !== locationId) {
    throw new HttpsError('failed-precondition', 'You are not at that location.');
  }

  const bossId = request.data?.bossId;

  const sessionRef = db.collection('combatSessions').doc(uid);
  const existingSession = await sessionRef.get();
  if (existingSession.exists) {
    const existing = existingSession.data() as CombatSession;
    const now = Date.now();
    if (existing.status === 'active' && existing.expiresAt > now) {
      // A genuine second call for the exact same fresh encounter within a couple seconds of the
      // first (React StrictMode double-invokes mount effects in development, and a doubled tap on
      // a "fight" interactable can race the same way) - hand back the same session instead of
      // erroring, rather than treating every repeat call as an attempt to reroll a losing fight.
      const isLikelyDuplicateCall =
        now - existing.startedAt < 3000 && existing.locationId === locationId && existing.enemies.length > 0;
      if (isLikelyDuplicateCall) {
        return {
          sessionId: existing.sessionId,
          enemies: existing.enemies.map((e, index) => ({
            index,
            enemyId: e.enemyId,
            name: ENEMIES[e.enemyId]?.name ?? e.enemyId,
            tier: ENEMIES[e.enemyId]?.tier,
            level: e.level,
            hp: e.hp,
            maxHp: e.maxHp,
            isBoss: ENEMIES[e.enemyId]?.isBoss,
          })),
          playerHp: save.player.stats.hp,
          playerMaxHp: save.player.stats.maxHp,
          playerSpirit: save.player.stats.spirit,
          playerMaxSpirit: save.player.stats.maxSpirit,
        };
      }
      // Anything else with an existing 'active' session is an abandoned fight (the player closed
      // the tab, refreshed, or navigated away mid-round - nothing ever marks a session resolved
      // except a full resolveCombatAction call reaching a terminal phase) rather than a deliberate
      // reroll attempt. Fall through and simply overwrite it with a freshly-rolled encounter, same
      // as the already-expired-session case below.
    }
  }

  let enemies;
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
  await sessionRef.set(session);

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
