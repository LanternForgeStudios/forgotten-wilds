import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { rollWaveEnemies } from '../engine/endlessBattleEngine';
import { restoreParticipantsAndClearLocks, fullyRestoredParticipantStats, rollBattleBackgroundAssetId, TURN_TIMEOUT_MS } from './partyBattle';
import { MAX_CLAN_SIZE } from '../shared-types';
import type {
  ClanDoc,
  ClanMembershipDoc,
  PartyBattleLockDoc,
  PartyBattleParticipantStats,
  PartyBattleSession,
  PlayerSave,
} from '../shared-types';

/** Endless Battle can only be started from a Town - the only place clan members can actually see
 *  each other via presence (Overworld/Dungeon scenes don't track it - see PlayerHUD.tsx's own doc
 *  comment). Wave enemies themselves aren't tied to this location at all (see
 *  endlessBattleEngine.ts) - this set exists purely to gate *where a party can form*. */
const TOWN_LOCATION_IDS = new Set(['ash-hallow']);

/** A non-terminal battle with no activity for this long is treated as abandoned (e.g. every
 *  participant's tab closed before the run ever reached a real end) rather than permanently
 *  blocking its participants from starting a new one - see resolveStaleLocks below. */
const STALE_BATTLE_TIMEOUT_MS = 10 * 60 * 1000;
const TERMINAL_STATUSES = new Set<PartyBattleSession['status']>(['victory', 'defeated', 'withdrawn']);

interface StartEndlessBattleRequest {
  participantUids: string[];
}

/**
 * Reads through every distinct battle the requested participants' locks point to and decides,
 * for each, whether it's safe to clear automatically: gone/orphaned, already terminal (should
 * have been cleared already, but defensively handled), or non-terminal but stale (no updates for
 * STALE_BATTLE_TIMEOUT_MS - almost certainly abandoned, e.g. every client closed before the run
 * ever reached a real end). Throws if any referenced battle is still genuinely active. Returns the
 * stale battles that need restoring/unlocking, for the caller to apply (a query result isn't a
 * write - the caller does the actual tx.set/tx.delete calls, keeping every write together).
 */
async function resolveStaleLocks(
  tx: Transaction,
  db: Firestore,
  lockSnaps: FirebaseFirestore.DocumentSnapshot[],
): Promise<{ ref: DocumentReference; battle: PartyBattleSession }[]> {
  const battleIds = Array.from(
    new Set(lockSnaps.filter((s) => s.exists).map((s) => (s.data() as PartyBattleLockDoc).battleId)),
  );
  if (battleIds.length === 0) return [];

  const battleRefs = battleIds.map((id) => db.collection('partyBattles').doc(id));
  const battleSnaps = await Promise.all(battleRefs.map((ref) => tx.get(ref)));

  const now = Date.now();
  const stale: { ref: DocumentReference; battle: PartyBattleSession }[] = [];
  battleSnaps.forEach((snap, i) => {
    if (!snap.exists) return; // orphaned lock - nothing to restore, just gets deleted below
    const battle = snap.data() as PartyBattleSession;
    if (TERMINAL_STATUSES.has(battle.status)) return; // already resolved - lock should already be gone
    if (now - battle.updatedAt > STALE_BATTLE_TIMEOUT_MS) {
      stale.push({ ref: battleRefs[i], battle });
      return;
    }
    throw new HttpsError('failed-precondition', 'One of those players is already in an active battle.');
  });
  return stale;
}

/**
 * Forms a party of 1-6 fellow clan members standing together in a Town (a lone clan member can
 * still fight solo - Endless Battle doesn't require company), restores every one of them to full
 * HP/Spirit/Oil (their real save is updated immediately, per the design doc), and rolls Wave 1.
 * Any clan member can start a run (not leader-only - forming a party is a group activity, unlike
 * clan administration).
 */
export const startEndlessBattle = onCall<StartEndlessBattleRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const participantUids = Array.from(new Set(request.data?.participantUids ?? []));
  if (!participantUids.includes(uid)) participantUids.push(uid);
  // A solo clan member (or a clan where only one member happens to be around) can still fight -
  // Endless Battle just runs with a party of one, the same as any other party size structurally.
  if (participantUids.length > MAX_CLAN_SIZE) {
    throw new HttpsError('invalid-argument', `A party can have at most ${MAX_CLAN_SIZE} players.`);
  }

  const db = getFirestore();
  const membershipRef = db.collection('clanMemberships').doc(uid);

  return db.runTransaction(async (tx) => {
    const membershipSnap = await tx.get(membershipRef);
    const clanId = (membershipSnap.data() as ClanMembershipDoc | undefined)?.clanId;
    if (!clanId) throw new HttpsError('failed-precondition', 'You are not in a clan.');

    const clanRef = db.collection('clans').doc(clanId);
    const lockRefs = participantUids.map((p) => db.collection('partyBattleLocks').doc(p));
    const userRefs = participantUids.map((p) => db.collection('users').doc(p));
    const [clanSnap, lockSnaps, userSnaps] = await Promise.all([
      tx.get(clanRef),
      Promise.all(lockRefs.map((ref) => tx.get(ref))),
      Promise.all(userRefs.map((ref) => tx.get(ref))),
    ]);
    if (!clanSnap.exists) throw new HttpsError('not-found', 'That clan no longer exists.');
    const clan = clanSnap.data() as ClanDoc;
    if (!participantUids.every((p) => clan.memberUids.includes(p))) {
      throw new HttpsError('failed-precondition', 'Every player must be a member of your clan.');
    }
    if (userSnaps.some((snap) => !snap.exists)) {
      throw new HttpsError('failed-precondition', 'A character could not be found.');
    }

    // Self-heals stale/abandoned locks (see resolveStaleLocks's own doc comment) instead of
    // permanently blocking these players - still throws if any lock points to a genuinely active
    // battle.
    const staleBattles = await resolveStaleLocks(tx, db, lockSnaps);

    const saves = userSnaps.map((snap) => snap.data() as PlayerSave);
    const locationId = saves[0].player.currentLocationId;
    if (!saves.every((s) => s.player.currentLocationId === locationId)) {
      throw new HttpsError('failed-precondition', 'Every player must be standing together to start a battle.');
    }
    if (!TOWN_LOCATION_IDS.has(locationId)) {
      throw new HttpsError('failed-precondition', 'Endless Battle can only be started from a Town.');
    }

    const partyAverageLevel = Math.round(saves.reduce((sum, s) => sum + s.player.level, 0) / saves.length);
    const enemies = rollWaveEnemies(1, partyAverageLevel);

    // Clear out anything self-healed above before writing the new battle/locks.
    for (const { battle } of staleBattles) {
      await restoreParticipantsAndClearLocks(tx, db, battle.participants);
    }

    const now = Date.now();
    const battleRef = db.collection('partyBattles').doc();
    const participantStats: Record<string, PartyBattleParticipantStats> = {};
    saves.forEach((save, i) => {
      const p = participantUids[i];
      // Restored to full per the design doc ("every player is automatically restored to 100%
      // Health, Spirit, and Lantern Oil" at battle start) - written to their real save right away,
      // not just snapshotted onto the battle doc, so it's still true even if they leave/the run
      // is abandoned before a proper end-of-run restore ever fires.
      save.player.stats.hp = save.player.stats.maxHp;
      save.player.stats.spirit = save.player.stats.maxSpirit;
      if (save.player.equipment.lantern) save.player.stats.lanternOil = save.player.stats.maxLanternOil;
      save.updatedAt = now;
      tx.set(userRefs[i], save);

      participantStats[p] = fullyRestoredParticipantStats(save);
    });

    const battle: PartyBattleSession = {
      id: battleRef.id,
      clanId,
      mode: 'endless',
      participants: participantUids,
      locationId,
      partyAverageLevel,
      battleBackgroundAssetId: rollBattleBackgroundAssetId(),
      wave: 1,
      enemies,
      round: 1,
      status: 'active',
      turnOrder: [...participantUids],
      currentTurnIndex: 0,
      turnDeadlineAt: now + TURN_TIMEOUT_MS,
      participantStats,
      lastTurnResult: null,
      lastWaveRewards: null,
      continueVotes: {},
      winnerUid: null,
      pvpRewards: null,
      startedAt: now,
      updatedAt: now,
    };
    tx.set(battleRef, battle);
    for (const ref of lockRefs) tx.set(ref, { battleId: battleRef.id } satisfies PartyBattleLockDoc);

    return { battleId: battleRef.id };
  });
});

interface VoteContinueEndlessBattleRequest {
  battleId: string;
  continue: boolean;
}

/**
 * Any *stop* vote ends the run immediately (simpler and safer than a majority count that could
 * leave a player stuck in a fight they wanted to leave) - all alive participants voting *continue*
 * is what's required to actually advance to the next wave. Restores every participant to full
 * vitals and clears their battle lock either way a run ends.
 */
export const voteContinueEndlessBattle = onCall<VoteContinueEndlessBattleRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const battleId = request.data?.battleId;
  const wantsToContinue = request.data?.continue;
  if (!battleId || typeof wantsToContinue !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Invalid request.');
  }

  const db = getFirestore();
  const battleRef = db.collection('partyBattles').doc(battleId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(battleRef);
    if (!snap.exists) throw new HttpsError('not-found', 'That battle no longer exists.');
    const battle = snap.data() as PartyBattleSession;
    if (!battle.participants.includes(uid)) throw new HttpsError('permission-denied', 'You are not part of this battle.');
    if (battle.status !== 'awaitingContinueVote') return { status: battle.status };

    if (!wantsToContinue) {
      await restoreParticipantsAndClearLocks(tx, db, battle.participants);
      tx.update(battleRef, { status: 'withdrawn', updatedAt: Date.now() });
      return { status: 'withdrawn' as const };
    }

    const alive = battle.participants.filter((p) => battle.participantStats[p].hp > 0);
    const votes = { ...battle.continueVotes, [uid]: true };
    const everyAliveVoted = alive.every((p) => votes[p]);

    if (!everyAliveVoted) {
      tx.update(battleRef, { [`continueVotes.${uid}`]: true, updatedAt: Date.now() });
      return { status: 'awaitingContinueVote' as const, waitingOn: alive.filter((p) => !votes[p]) };
    }

    const nextWave = battle.wave + 1;
    const enemies = rollWaveEnemies(nextWave, battle.partyAverageLevel);
    const now = Date.now();
    tx.update(battleRef, {
      wave: nextWave,
      enemies,
      status: 'active',
      turnOrder: alive,
      currentTurnIndex: 0,
      turnDeadlineAt: now + TURN_TIMEOUT_MS,
      continueVotes: {},
      updatedAt: now,
    });
    return { status: 'active' as const, wave: nextWave };
  });
});
