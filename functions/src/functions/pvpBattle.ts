import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { fullyRestoredParticipantStats, rollBattleBackgroundAssetId, TURN_TIMEOUT_MS } from './partyBattle';
import type {
  ClanMembershipDoc,
  FriendshipDoc,
  PartyBattleParticipantStats,
  PartyBattleSession,
  PlayerSave,
  PvpChallengeDoc,
  PvpQueueEntry,
} from '../shared-types';

/**
 * Starts a 1-on-1 PvP battle between two players inside the given transaction - shared by
 * respondToPvpChallenge (accepted challenge) and joinPvpQueue (matchmaking hit) so the two entry
 * points can't drift on how a match actually gets set up. Re-checks both players' battle locks
 * here (not just at challenge-send/queue-join time) since time can pass between then and now -
 * whoever locked in first wins the race, the other gets a clear "already in a battle" error rather
 * than silently overwriting an in-progress fight.
 */
async function startPvpBattleInTransaction(
  tx: Transaction,
  db: Firestore,
  participantUids: [string, string],
): Promise<string> {
  const lockRefs = participantUids.map((p) => db.collection('partyBattleLocks').doc(p));
  const userRefs = participantUids.map((p) => db.collection('users').doc(p));
  const [lockSnaps, userSnaps] = await Promise.all([
    Promise.all(lockRefs.map((ref) => tx.get(ref))),
    Promise.all(userRefs.map((ref) => tx.get(ref))),
  ]);
  if (lockSnaps.some((s) => s.exists)) {
    throw new HttpsError('failed-precondition', 'One of those players is already in a battle.');
  }
  if (userSnaps.some((s) => !s.exists)) {
    throw new HttpsError('failed-precondition', 'A character could not be found.');
  }

  const saves = userSnaps.map((s) => s.data() as PlayerSave);
  const now = Date.now();
  const battleRef = db.collection('partyBattles').doc();
  const participantStats: Record<string, PartyBattleParticipantStats> = {};
  saves.forEach((save, i) => {
    const p = participantUids[i];
    // Full restore before the fight, same "every player starts at 100%" rule as Endless Battle -
    // written to the real save immediately, not just the battle doc snapshot.
    save.player.stats.hp = save.player.stats.maxHp;
    save.player.stats.spirit = save.player.stats.maxSpirit;
    if (save.player.equipment.lantern) save.player.stats.lanternOil = save.player.stats.maxLanternOil;
    save.updatedAt = now;
    tx.set(userRefs[i], save);
    participantStats[p] = fullyRestoredParticipantStats(save);
  });

  const partyAverageLevel = Math.round(saves.reduce((sum, s) => sum + s.player.level, 0) / saves.length);

  const battle: PartyBattleSession = {
    id: battleRef.id,
    clanId: null,
    mode: 'pvp',
    participants: participantUids,
    locationId: saves[0].player.currentLocationId,
    partyAverageLevel,
    battleBackgroundAssetId: rollBattleBackgroundAssetId(),
    wave: 1,
    enemies: [],
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
  for (const ref of lockRefs) tx.set(ref, { battleId: battleRef.id });
  return battleRef.id;
}

interface ChallengeToPvpRequest {
  toUid: string;
}

/**
 * Sends a PvP challenge to a friend or clanmate (the design doc's "friend/clan challenge" entry
 * point - matchmaking against a stranger is joinPvpQueue's job instead). Deterministic
 * `${fromUid}_${toUid}` doc id, same reuse-the-doc-on-a-repeat-challenge pattern as
 * sendFriendRequest.
 */
export const challengeToPvp = onCall<ChallengeToPvpRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const toUid = request.data?.toUid;
  if (!toUid || toUid === uid) throw new HttpsError('invalid-argument', 'Invalid target user.');

  const db = getFirestore();
  const challengeRef = db.collection('pvpChallenges').doc(`${uid}_${toUid}`);

  return db.runTransaction(async (tx) => {
    const [existingSnap, friendsSnap, myMembershipSnap, theirMembershipSnap, myLockSnap, theirLockSnap, mySaveSnap, theirSaveSnap] =
      await Promise.all([
        tx.get(challengeRef),
        tx.get(db.collection('friendships').doc(uid)),
        tx.get(db.collection('clanMemberships').doc(uid)),
        tx.get(db.collection('clanMemberships').doc(toUid)),
        tx.get(db.collection('partyBattleLocks').doc(uid)),
        tx.get(db.collection('partyBattleLocks').doc(toUid)),
        tx.get(db.collection('users').doc(uid)),
        tx.get(db.collection('users').doc(toUid)),
      ]);
    if (!theirSaveSnap.exists) throw new HttpsError('not-found', 'No such user.');

    const isFriend = ((friendsSnap.data() as FriendshipDoc | undefined)?.friendUids ?? []).includes(toUid);
    const myClanId = (myMembershipSnap.data() as ClanMembershipDoc | undefined)?.clanId;
    const theirClanId = (theirMembershipSnap.data() as ClanMembershipDoc | undefined)?.clanId;
    const sameClan = !!myClanId && myClanId === theirClanId;
    if (!isFriend && !sameClan) {
      throw new HttpsError('failed-precondition', 'You can only challenge a friend or clanmate to PvP.');
    }
    if (myLockSnap.exists) throw new HttpsError('failed-precondition', 'You are already in a battle.');
    if (theirLockSnap.exists) throw new HttpsError('failed-precondition', 'That player is already in a battle.');
    if (existingSnap.exists && (existingSnap.data() as PvpChallengeDoc).status === 'pending') {
      return { status: 'already-pending' as const };
    }

    const mySave = mySaveSnap.data() as PlayerSave;
    const theirSave = theirSaveSnap.data() as PlayerSave;
    const challenge: PvpChallengeDoc = {
      id: challengeRef.id,
      fromUid: uid,
      fromDisplayName: mySave.displayName,
      toUid,
      toDisplayName: theirSave.displayName,
      status: 'pending',
      createdAt: Date.now(),
    };
    tx.set(challengeRef, challenge);
    return { status: 'sent' as const };
  });
});

interface RespondToPvpChallengeRequest {
  challengeId: string;
  accept: boolean;
}

export const respondToPvpChallenge = onCall<RespondToPvpChallengeRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const { challengeId, accept } = request.data ?? {};
  if (!challengeId) throw new HttpsError('invalid-argument', 'No challenge specified.');

  const db = getFirestore();
  const challengeRef = db.collection('pvpChallenges').doc(challengeId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(challengeRef);
    if (!snap.exists) throw new HttpsError('not-found', 'That challenge no longer exists.');
    const challenge = snap.data() as PvpChallengeDoc;
    if (challenge.toUid !== uid) {
      throw new HttpsError('permission-denied', 'This challenge is not addressed to you.');
    }
    if (challenge.status !== 'pending') {
      return { status: challenge.status };
    }
    if (!accept) {
      tx.update(challengeRef, { status: 'declined' });
      return { status: 'declined' as const };
    }

    const battleId = await startPvpBattleInTransaction(tx, db, [challenge.fromUid, challenge.toUid]);
    tx.update(challengeRef, { status: 'accepted' });
    return { status: 'accepted' as const, battleId };
  });
});

/**
 * "Basic matchmaking" per the design doc's own reduced ambition for casual PvP - joining greedily
 * matches against whichever other currently-queued player is closest in level (ties broken by
 * whoever's waited longest), rather than a real matchmaking service. Reading the whole pvpQueue
 * collection inside the transaction means a concurrent join/match anywhere in the queue forces
 * this transaction to retry (Firestore's normal optimistic-concurrency behavior), which is what
 * stops two simultaneous joiners from both grabbing the same opponent.
 */
export const joinPvpQueue = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const db = getFirestore();
  const myQueueRef = db.collection('pvpQueue').doc(uid);

  return db.runTransaction(async (tx) => {
    const [myLockSnap, mySaveSnap, queueSnap] = await Promise.all([
      tx.get(db.collection('partyBattleLocks').doc(uid)),
      tx.get(db.collection('users').doc(uid)),
      tx.get(db.collection('pvpQueue')),
    ]);
    if (myLockSnap.exists) throw new HttpsError('failed-precondition', 'You are already in a battle.');
    if (!mySaveSnap.exists) throw new HttpsError('failed-precondition', 'Character not found.');
    const mySave = mySaveSnap.data() as PlayerSave;

    const candidates = queueSnap.docs.map((d) => d.data() as PvpQueueEntry).filter((e) => e.uid !== uid);
    if (candidates.length === 0) {
      const entry: PvpQueueEntry = { uid, level: mySave.player.level, joinedAt: Date.now() };
      tx.set(myQueueRef, entry);
      return { matched: false as const };
    }

    candidates.sort((a, b) => {
      const levelDiff = Math.abs(a.level - mySave.player.level) - Math.abs(b.level - mySave.player.level);
      return levelDiff !== 0 ? levelDiff : a.joinedAt - b.joinedAt;
    });
    const opponentUid = candidates[0].uid;
    const battleId = await startPvpBattleInTransaction(tx, db, [uid, opponentUid]);
    tx.delete(db.collection('pvpQueue').doc(opponentUid));
    return { matched: true as const, battleId };
  });
});

export const leavePvpQueue = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  await getFirestore().collection('pvpQueue').doc(uid).delete();
  return { left: true };
});
