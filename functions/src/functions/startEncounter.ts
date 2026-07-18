import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { rollEncounterGroup, rollBossEncounter, rollEnemyLevel, scaledEnemyStats } from '../engine/combatEngine';
import { ENEMIES } from '../data/enemies';
import { effectiveStatus } from '../engine/questEngine';
import type { CombatSession, PlayerSave } from '../shared-types';

interface StartEncounterRequest {
  locationId: string;
  /** Set only for deliberate boss encounters triggered from a dungeon's boss interactable. */
  bossId?: string;
}

/** Which location a given boss must actually be fought at - the generic `currentLocationId !==
 *  locationId` check above only verifies the player is wherever the request *claims*, not that
 *  the claimed location is this boss's real lair, so without this a client could pass any
 *  location it's genuinely standing in alongside a bossId, skipping the dungeon traversal
 *  DungeonScene.tsx's own boss interactable trigger requires. Not to be confused with
 *  BOSS_REGION_LOCATIONS (combatEngine.ts) - that one's only for rolling which "adds" can join a
 *  boss fight, not for gating where the fight can start. */
const BOSS_REQUIRED_LOCATION: Record<string, string> = {
  'coalbound-warden': 'hollow-rail-mine',
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
  const sessionRef = db.collection('combatSessions').doc(uid);
  const bossId = request.data?.bossId;

  // Previously two plain (non-transactional) get()/set() calls - a genuinely concurrent pair of
  // calls (not just the sequential "duplicate call within 3s" case isLikelyDuplicateCall already
  // handles below) could both read "no active session" before either write landed, both roll a
  // separate encounter, and have the second set() silently clobber the first - stranding the
  // first client with a sessionId the server no longer recognizes on its next
  // resolveCombatAction call. Wrapping in a transaction (all reads before the write, per every
  // other state-changing function here) closes that race.
  return db.runTransaction(async (tx) => {
    const [userSnap, existingSession] = await Promise.all([tx.get(userRef), tx.get(sessionRef)]);
    if (!userSnap.exists) {
      throw new HttpsError('failed-precondition', 'No character found for this account.');
    }
    const save = userSnap.data() as PlayerSave;

    if (save.player.currentLocationId !== locationId) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }

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
              ailments: e.ailments ?? [],
            })),
            playerHp: save.player.stats.hp,
            playerMaxHp: save.player.stats.maxHp,
            playerSpirit: save.player.stats.spirit,
            playerMaxSpirit: save.player.stats.maxSpirit,
            // Backfill for sessions created before playerAilments existed - see the itemsDiscovered
            // precedent for this lazy-migration pattern.
            playerAilments: existing.playerAilments ?? [],
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
      const prerequisite = ENEMIES[bossId]?.prerequisiteQuestId;
      const questsDone = !prerequisite || effectiveStatus(prerequisite, save.quests) === 'completed';
      const atRequiredLocation = BOSS_REQUIRED_LOCATION[bossId] === locationId;
      if (!ENEMIES[bossId]?.isBoss || !questsDone || !atRequiredLocation) {
        throw new HttpsError('failed-precondition', 'That boss cannot be challenged yet.');
      }
      // The boss itself plus 0-3 additional enemies drawn from its region - see rollBossEncounter.
      enemies = rollBossEncounter(bossId);
    } else {
      try {
        enemies = rollEncounterGroup(locationId, save.player.level);
      } catch {
        throw new HttpsError('invalid-argument', `No enemies are known to roam "${locationId}".`);
      }
    }

    const rolledLevels = enemies.map(() => rollEnemyLevel(save.player.level));
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
        ailments: [],
      })),
      round: 1,
      status: 'active',
      startedAt: now,
      expiresAt: now + 30 * 60 * 1000,
      playerAilments: [],
    };
    tx.set(sessionRef, session);

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
        ailments: [],
      })),
      playerHp: save.player.stats.hp,
      playerMaxHp: save.player.stats.maxHp,
      playerSpirit: save.player.stats.spirit,
      playerMaxSpirit: save.player.stats.maxSpirit,
      playerAilments: session.playerAilments,
    };
  });
});
