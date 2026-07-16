import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { rollWaveEnemies } from '../engine/endlessBattleEngine';
import { MAX_CLAN_SIZE } from '../shared-types';
import type {
  ClanDoc,
  ClanMembershipDoc,
  PartyBattleLockDoc,
  PartyBattleParticipantStats,
  PartyBattleSession,
  PlayerSave,
} from '../shared-types';

const TURN_TIMEOUT_MS = 20_000;

interface StartEndlessBattleRequest {
  participantUids: string[];
}

/**
 * Forms a party from 2-6 fellow clan members standing at the same location as the caller,
 * restores every one of them to full HP/Spirit/Oil (their real save is updated immediately, per
 * the design doc), and rolls Wave 1. Any clan member can start a run (not leader-only - forming a
 * party is a group activity, unlike clan administration).
 */
export const startEndlessBattle = onCall<StartEndlessBattleRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const participantUids = Array.from(new Set(request.data?.participantUids ?? []));
  if (!participantUids.includes(uid)) participantUids.push(uid);
  if (participantUids.length < 2 || participantUids.length > MAX_CLAN_SIZE) {
    throw new HttpsError('invalid-argument', `A party needs 2-${MAX_CLAN_SIZE} players.`);
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
    if (lockSnaps.some((snap) => snap.exists)) {
      throw new HttpsError('failed-precondition', 'One of those players is already in a battle.');
    }
    if (userSnaps.some((snap) => !snap.exists)) {
      throw new HttpsError('failed-precondition', 'A character could not be found.');
    }

    const saves = userSnaps.map((snap) => snap.data() as PlayerSave);
    const locationId = saves[0].player.currentLocationId;
    if (!saves.every((s) => s.player.currentLocationId === locationId)) {
      throw new HttpsError('failed-precondition', 'Every player must be standing together to start a battle.');
    }

    const partyAverageLevel = Math.round(
      saves.reduce((sum, s) => sum + s.player.level, 0) / saves.length,
    );

    let enemies;
    try {
      enemies = rollWaveEnemies(locationId, 1, partyAverageLevel);
    } catch {
      throw new HttpsError('invalid-argument', `No enemies are known to roam "${locationId}".`);
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

      participantStats[p] = {
        hp: save.player.stats.maxHp,
        maxHp: save.player.stats.maxHp,
        spirit: save.player.stats.maxSpirit,
        maxSpirit: save.player.stats.maxSpirit,
        lanternOil: save.player.stats.maxLanternOil,
        maxLanternOil: save.player.stats.maxLanternOil,
        attack: save.player.stats.attack,
        defense: save.player.stats.defense,
        speed: save.player.stats.speed,
        ailments: [],
      };
    });

    const battle: PartyBattleSession = {
      id: battleRef.id,
      clanId,
      mode: 'endless',
      participants: participantUids,
      locationId,
      partyAverageLevel,
      wave: 1,
      enemies,
      round: 1,
      status: 'active',
      turnDeadlineAt: now + TURN_TIMEOUT_MS,
      pendingActions: Object.fromEntries(participantUids.map((p) => [p, null])),
      participantStats,
      lastRoundResult: null,
      lastWaveRewards: null,
      continueVotes: {},
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

async function endRun(tx: Transaction, db: Firestore, battle: PartyBattleSession): Promise<void> {
  const userRefs = battle.participants.map((p) => db.collection('users').doc(p));
  const snaps = await Promise.all(userRefs.map((ref) => tx.get(ref)));
  snaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const save = snap.data() as PlayerSave;
    save.player.stats.hp = save.player.stats.maxHp;
    save.player.stats.spirit = save.player.stats.maxSpirit;
    if (save.player.equipment.lantern) save.player.stats.lanternOil = save.player.stats.maxLanternOil;
    save.updatedAt = Date.now();
    tx.set(userRefs[i], save);
  });
  for (const p of battle.participants) tx.delete(db.collection('partyBattleLocks').doc(p));
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
      await endRun(tx, db, battle);
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
    let enemies;
    try {
      enemies = rollWaveEnemies(battle.locationId, nextWave, battle.partyAverageLevel);
    } catch {
      throw new HttpsError('internal', 'Could not roll the next wave.');
    }
    const now = Date.now();
    tx.update(battleRef, {
      wave: nextWave,
      enemies,
      status: 'active',
      pendingActions: Object.fromEntries(battle.participants.map((p) => [p, null])),
      turnDeadlineAt: now + TURN_TIMEOUT_MS,
      continueVotes: {},
      updatedAt: now,
    });
    return { status: 'active' as const, wave: nextWave };
  });
});
