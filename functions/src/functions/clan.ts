import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { MAX_CLAN_SIZE } from '../shared-types';
import type { ClanDoc, ClanInvite, ClanMembershipDoc, PlayerSave } from '../shared-types';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 24;
const TAG_MIN_LENGTH = 2;
const TAG_MAX_LENGTH = 5;

function validateClanName(raw: unknown): string {
  if (typeof raw !== 'string') throw new HttpsError('invalid-argument', 'Clan name is required.');
  const name = raw.trim();
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    throw new HttpsError('invalid-argument', `Clan name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`);
  }
  return name;
}

function validateClanTag(raw: unknown): string {
  if (typeof raw !== 'string') throw new HttpsError('invalid-argument', 'Clan tag is required.');
  const tag = raw.trim().toUpperCase();
  if (tag.length < TAG_MIN_LENGTH || tag.length > TAG_MAX_LENGTH || !/^[A-Z0-9]+$/.test(tag)) {
    throw new HttpsError(
      'invalid-argument',
      `Clan tag must be ${TAG_MIN_LENGTH}-${TAG_MAX_LENGTH} letters/numbers only.`,
    );
  }
  return tag;
}

/** Resolves a display name for a clan invite the same way friends.ts's sendFriendRequest does -
 *  the authoritative users/{uid} save first, userDirectory as a fallback for a possibly-stale
 *  denormalized copy, 'A Keeper' as an absolute last resort. */
async function resolveDisplayName(db: Firestore, tx: Transaction, uid: string): Promise<string> {
  const [saveSnap, dirSnap] = await Promise.all([
    tx.get(db.collection('users').doc(uid)),
    tx.get(db.collection('userDirectory').doc(uid)),
  ]);
  return (
    (saveSnap.data() as PlayerSave | undefined)?.displayName ??
    (dirSnap.data()?.displayName as string | undefined) ??
    'A Keeper'
  );
}

interface CreateClanRequest {
  name: string;
  tag: string;
}

export const createClan = onCall<CreateClanRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const name = validateClanName(request.data?.name);
  const tag = validateClanTag(request.data?.tag);

  const db = getFirestore();
  const membershipRef = db.collection('clanMemberships').doc(uid);
  const clanRef = db.collection('clans').doc();

  return db.runTransaction(async (tx) => {
    const membershipSnap = await tx.get(membershipRef);
    if ((membershipSnap.data() as ClanMembershipDoc | undefined)?.clanId) {
      throw new HttpsError('failed-precondition', 'You are already in a clan - leave it first.');
    }

    const now = Date.now();
    const clan: ClanDoc = {
      id: clanRef.id,
      name,
      tag,
      leaderUid: uid,
      memberUids: [uid],
      level: 0,
      xp: 0,
      highestEndlessWave: 0,
      createdAt: now,
      updatedAt: now,
    };
    const membership: ClanMembershipDoc = { clanId: clanRef.id };

    tx.set(clanRef, clan);
    tx.set(membershipRef, membership);
    return { clanId: clanRef.id };
  });
});

interface InviteToClanRequest {
  clanId: string;
  toUid: string;
}

/** Leader-only, per the doc's "The Clan Leader may: Invite players." Deterministic invite doc id
 *  (`${clanId}_${toUid}`, mirroring friendRequests' own deterministic-id reasoning) - a clan can
 *  only ever have one live invite out to a given person at once, so there's no need for an
 *  auto-id plus a dedup query. */
export const inviteToClan = onCall<InviteToClanRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const clanId = request.data?.clanId;
  const toUid = request.data?.toUid;
  if (!clanId || !toUid || toUid === uid) throw new HttpsError('invalid-argument', 'Invalid invite.');

  const db = getFirestore();
  const clanRef = db.collection('clans').doc(clanId);
  const targetMembershipRef = db.collection('clanMemberships').doc(toUid);
  const inviteRef = db.collection('clanInvites').doc(`${clanId}_${toUid}`);

  return db.runTransaction(async (tx) => {
    const [clanSnap, targetMembershipSnap, inviteSnap] = await Promise.all([
      tx.get(clanRef),
      tx.get(targetMembershipRef),
      tx.get(inviteRef),
    ]);
    if (!clanSnap.exists) throw new HttpsError('not-found', 'That clan no longer exists.');
    const clan = clanSnap.data() as ClanDoc;
    if (clan.leaderUid !== uid) throw new HttpsError('permission-denied', 'Only the clan leader can invite.');
    if (clan.memberUids.length >= MAX_CLAN_SIZE) throw new HttpsError('failed-precondition', 'This clan is full.');
    if ((targetMembershipSnap.data() as ClanMembershipDoc | undefined)?.clanId) {
      throw new HttpsError('failed-precondition', 'That player is already in a clan.');
    }
    const existingInvite = inviteSnap.data() as ClanInvite | undefined;
    if (existingInvite?.status === 'pending') {
      throw new HttpsError('failed-precondition', 'That player already has a pending invite from this clan.');
    }

    const [fromDisplayName, toDisplayName] = await Promise.all([
      resolveDisplayName(db, tx, uid),
      resolveDisplayName(db, tx, toUid),
    ]);

    const invite: ClanInvite = {
      id: inviteRef.id,
      clanId,
      clanName: clan.name,
      fromUid: uid,
      fromDisplayName,
      toUid,
      toDisplayName,
      status: 'pending',
      createdAt: Date.now(),
    };
    tx.set(inviteRef, invite);
    return { status: 'sent' as const };
  });
});

interface RespondToClanInviteRequest {
  inviteId: string;
  accept: boolean;
}

export const respondToClanInvite = onCall<RespondToClanInviteRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const inviteId = request.data?.inviteId;
  const accept = request.data?.accept;
  if (!inviteId || typeof accept !== 'boolean') throw new HttpsError('invalid-argument', 'Invalid request.');

  const db = getFirestore();
  const inviteRef = db.collection('clanInvites').doc(inviteId);

  return db.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) throw new HttpsError('not-found', 'That invite no longer exists.');
    const invite = inviteSnap.data() as ClanInvite;
    if (invite.toUid !== uid) throw new HttpsError('permission-denied', 'This invite is not addressed to you.');
    if (invite.status !== 'pending') return { status: invite.status };

    if (!accept) {
      tx.update(inviteRef, { status: 'declined' });
      return { status: 'declined' as const };
    }

    const membershipRef = db.collection('clanMemberships').doc(uid);
    const clanRef = db.collection('clans').doc(invite.clanId);
    const [membershipSnap, clanSnap] = await Promise.all([tx.get(membershipRef), tx.get(clanRef)]);
    if ((membershipSnap.data() as ClanMembershipDoc | undefined)?.clanId) {
      throw new HttpsError('failed-precondition', 'You are already in a clan.');
    }
    if (!clanSnap.exists) throw new HttpsError('not-found', 'That clan no longer exists.');
    const clan = clanSnap.data() as ClanDoc;
    if (clan.memberUids.length >= MAX_CLAN_SIZE) {
      throw new HttpsError('failed-precondition', 'That clan filled up before you could join.');
    }

    tx.update(clanRef, { memberUids: [...clan.memberUids, uid], updatedAt: Date.now() });
    tx.set(membershipRef, { clanId: invite.clanId } satisfies ClanMembershipDoc);
    tx.update(inviteRef, { status: 'accepted' });
    return { status: 'accepted' as const };
  });
});

export const leaveClan = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const db = getFirestore();
  const membershipRef = db.collection('clanMemberships').doc(uid);

  return db.runTransaction(async (tx) => {
    const membershipSnap = await tx.get(membershipRef);
    const clanId = (membershipSnap.data() as ClanMembershipDoc | undefined)?.clanId;
    if (!clanId) throw new HttpsError('failed-precondition', 'You are not in a clan.');

    const clanRef = db.collection('clans').doc(clanId);
    const clanSnap = await tx.get(clanRef);
    if (!clanSnap.exists) {
      // Clan is already gone (e.g. disbanded without this membership doc catching up somehow) -
      // still let the player's own stale membership doc clear.
      tx.set(membershipRef, { clanId: null } satisfies ClanMembershipDoc);
      return { left: true };
    }
    const clan = clanSnap.data() as ClanDoc;
    if (clan.leaderUid === uid) {
      throw new HttpsError('failed-precondition', 'Transfer leadership or disband the clan before leaving.');
    }

    tx.update(clanRef, { memberUids: clan.memberUids.filter((m) => m !== uid), updatedAt: Date.now() });
    tx.set(membershipRef, { clanId: null } satisfies ClanMembershipDoc);
    return { left: true };
  });
});

interface RemoveFromClanRequest {
  uid: string;
}

export const removeFromClan = onCall<RemoveFromClanRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const targetUid = request.data?.uid;
  if (!targetUid || targetUid === uid) throw new HttpsError('invalid-argument', 'Invalid member.');

  const db = getFirestore();
  const membershipRef = db.collection('clanMemberships').doc(uid);

  return db.runTransaction(async (tx) => {
    const membershipSnap = await tx.get(membershipRef);
    const clanId = (membershipSnap.data() as ClanMembershipDoc | undefined)?.clanId;
    if (!clanId) throw new HttpsError('failed-precondition', 'You are not in a clan.');

    const clanRef = db.collection('clans').doc(clanId);
    const clanSnap = await tx.get(clanRef);
    if (!clanSnap.exists) throw new HttpsError('not-found', 'That clan no longer exists.');
    const clan = clanSnap.data() as ClanDoc;
    if (clan.leaderUid !== uid) throw new HttpsError('permission-denied', 'Only the clan leader can remove members.');
    if (!clan.memberUids.includes(targetUid)) {
      throw new HttpsError('failed-precondition', 'That player is not in this clan.');
    }

    const targetMembershipRef = db.collection('clanMemberships').doc(targetUid);
    tx.update(clanRef, { memberUids: clan.memberUids.filter((m) => m !== targetUid), updatedAt: Date.now() });
    tx.set(targetMembershipRef, { clanId: null } satisfies ClanMembershipDoc);
    return { removed: true };
  });
});

interface TransferClanLeadershipRequest {
  toUid: string;
}

export const transferClanLeadership = onCall<TransferClanLeadershipRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const toUid = request.data?.toUid;
  if (!toUid || toUid === uid) throw new HttpsError('invalid-argument', 'Invalid new leader.');

  const db = getFirestore();
  const membershipRef = db.collection('clanMemberships').doc(uid);

  return db.runTransaction(async (tx) => {
    const membershipSnap = await tx.get(membershipRef);
    const clanId = (membershipSnap.data() as ClanMembershipDoc | undefined)?.clanId;
    if (!clanId) throw new HttpsError('failed-precondition', 'You are not in a clan.');

    const clanRef = db.collection('clans').doc(clanId);
    const clanSnap = await tx.get(clanRef);
    if (!clanSnap.exists) throw new HttpsError('not-found', 'That clan no longer exists.');
    const clan = clanSnap.data() as ClanDoc;
    if (clan.leaderUid !== uid) throw new HttpsError('permission-denied', 'Only the clan leader can transfer leadership.');
    if (!clan.memberUids.includes(toUid)) throw new HttpsError('failed-precondition', 'That player is not in this clan.');

    tx.update(clanRef, { leaderUid: toUid, updatedAt: Date.now() });
    return { newLeaderUid: toUid };
  });
});

export const disbandClan = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const db = getFirestore();
  const membershipRef = db.collection('clanMemberships').doc(uid);

  return db.runTransaction(async (tx) => {
    const membershipSnap = await tx.get(membershipRef);
    const clanId = (membershipSnap.data() as ClanMembershipDoc | undefined)?.clanId;
    if (!clanId) throw new HttpsError('failed-precondition', 'You are not in a clan.');

    const clanRef = db.collection('clans').doc(clanId);
    const clanSnap = await tx.get(clanRef);
    if (!clanSnap.exists) {
      tx.set(membershipRef, { clanId: null } satisfies ClanMembershipDoc);
      return { disbanded: true };
    }
    const clan = clanSnap.data() as ClanDoc;
    if (clan.leaderUid !== uid) throw new HttpsError('permission-denied', 'Only the clan leader can disband it.');

    // Every member's own clanMemberships/{uid} doc must be read before any write in this
    // transaction (Firestore's read-before-write rule) - at most MAX_CLAN_SIZE (6) extra reads.
    const memberRefs = clan.memberUids.map((m) => db.collection('clanMemberships').doc(m));
    await Promise.all(memberRefs.map((ref) => tx.get(ref)));

    for (const ref of memberRefs) {
      tx.set(ref, { clanId: null } satisfies ClanMembershipDoc);
    }
    tx.delete(clanRef);
    return { disbanded: true };
  });
});
