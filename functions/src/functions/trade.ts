import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import {
  escrowOffer,
  mergeOfferInto,
  mergeTradeItemRequests,
  releaseOffer,
  validateTradeOfferItems,
  type TradeItemRequest,
} from '../engine/tradeEngine';
import type { ActiveTradeLockDoc, FriendshipDoc, PlayerSave, TradeDoc, TradeOfferSide } from '../shared-types';

/** Deterministic key for the one-active-trade-per-pair lock, independent of who's the initiator
 *  this time - mirrors friendRequests' own use of a sorted/deterministic id for exactly the same
 *  "no duplicate in either direction" reason. Exported so blocking.ts can look up (and terminate)
 *  an active trade between a pair being blocked, without duplicating this helper. */
export function sortedPairKey(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

function validateGold(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw) || raw < 0) {
    throw new HttpsError('invalid-argument', 'Invalid gold amount.');
  }
  return raw;
}

function validateItemsShape(raw: unknown): TradeItemRequest[] {
  if (!Array.isArray(raw)) throw new HttpsError('invalid-argument', 'Invalid items.');
  return raw.map((entry) => {
    const itemId = (entry as { itemId?: unknown } | null)?.itemId;
    const quantity = (entry as { quantity?: unknown } | null)?.quantity;
    if (typeof itemId !== 'string' || typeof quantity !== 'number') {
      throw new HttpsError('invalid-argument', 'Invalid item entry.');
    }
    return { itemId, quantity };
  });
}

interface ProposeTradeRequest {
  toUid: string;
  items: { itemId: string; quantity: number }[];
  gold: number;
}

/** Only allowed between friends (mirrors sendDirectMessage.ts's friendship check - friendship
 *  already implies not-blocked, so this doesn't separately check blocks/{uid}). Escrows the
 *  initiator's offer immediately - see tradeEngine.ts's escrowOffer for why that's what makes an
 *  offered item/gold amount unusable elsewhere for the life of the trade. The activeTradeLocks
 *  doc (read via tx.get, a doc ref - every transaction read in this codebase is a doc ref, never
 *  a query) makes "no other active trade already exists between this pair" race-free; a
 *  query-then-transact check here would have a TOCTOU gap between two concurrent proposals. */
export const proposeTrade = onCall<ProposeTradeRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const toUid = request.data?.toUid;
  if (!toUid || toUid === uid) throw new HttpsError('invalid-argument', 'Invalid trade partner.');

  const items = mergeTradeItemRequests(validateItemsShape(request.data?.items ?? []));
  const gold = validateGold(request.data?.gold ?? 0);
  if (items.length === 0 && gold === 0) {
    throw new HttpsError('invalid-argument', 'Offer at least one item or some gold.');
  }

  const db = getFirestore();
  const friendsSnap = await db.collection('friendships').doc(uid).get();
  const isFriend = ((friendsSnap.data() as FriendshipDoc | undefined)?.friendUids ?? []).includes(toUid);
  if (!isFriend) throw new HttpsError('failed-precondition', 'You can only trade with friends.');

  const userRef = db.collection('users').doc(uid);
  const lockRef = db.collection('activeTradeLocks').doc(sortedPairKey(uid, toUid));
  const tradeRef = db.collection('trades').doc();

  return db.runTransaction(async (tx) => {
    const [userSnap, lockSnap] = await Promise.all([tx.get(userRef), tx.get(lockRef)]);
    if (!userSnap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    if (lockSnap.exists) {
      throw new HttpsError('failed-precondition', 'You already have an active trade with this player.');
    }

    const save = userSnap.data() as PlayerSave;
    const validation = validateTradeOfferItems(items, save.inventory, save.player.equipment);
    if (!validation.ok) throw new HttpsError('failed-precondition', validation.message ?? 'Invalid offer.');
    if (gold > save.player.gold) throw new HttpsError('failed-precondition', 'Not enough gold.');

    const offer: TradeOfferSide = { items, gold };
    escrowOffer(save, offer);
    save.updatedAt = Date.now();

    const now = Date.now();
    const trade: TradeDoc = {
      id: tradeRef.id,
      participants: [uid, toUid],
      initiatorUid: uid,
      recipientUid: toUid,
      status: 'awaiting_recipient',
      initiatorOffer: offer,
      recipientOffer: null,
      createdAt: now,
      updatedAt: now,
    };
    const lock: ActiveTradeLockDoc = { tradeId: tradeRef.id };

    tx.set(userRef, save);
    tx.set(tradeRef, trade);
    tx.set(lockRef, lock);
    return { tradeId: tradeRef.id };
  });
});

interface RespondToTradeOfferRequest {
  tradeId: string;
  action: 'decline' | 'counter';
  items?: { itemId: string; quantity: number }[];
  gold?: number;
}

/** The recipient's one and only move at awaiting_recipient - decline (initiator's escrow comes
 *  straight back) or counter (recipient's own offer escrows the same way proposeTrade's did,
 *  handing the final yes/no back to the initiator via finalizeTrade). One transaction branching
 *  on `action`, mirroring respondToFriendRequest's single-transaction accept/decline shape rather
 *  than two separate transactions. */
export const respondToTradeOffer = onCall<RespondToTradeOfferRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const tradeId = request.data?.tradeId;
  const action = request.data?.action;
  if (!tradeId || (action !== 'decline' && action !== 'counter')) {
    throw new HttpsError('invalid-argument', 'Invalid request.');
  }

  let counterOffer: TradeOfferSide | null = null;
  if (action === 'counter') {
    const items = mergeTradeItemRequests(validateItemsShape(request.data?.items ?? []));
    const gold = validateGold(request.data?.gold ?? 0);
    counterOffer = { items, gold };
  }

  const db = getFirestore();
  const tradeRef = db.collection('trades').doc(tradeId);

  return db.runTransaction(async (tx) => {
    const tradeSnap = await tx.get(tradeRef);
    if (!tradeSnap.exists) throw new HttpsError('not-found', 'That trade no longer exists.');
    const trade = tradeSnap.data() as TradeDoc;
    if (trade.recipientUid !== uid) {
      throw new HttpsError('permission-denied', 'This trade is not addressed to you.');
    }
    if (trade.status !== 'awaiting_recipient') return { status: trade.status };

    const lockRef = db.collection('activeTradeLocks').doc(sortedPairKey(trade.initiatorUid, trade.recipientUid));

    if (action === 'decline') {
      const initiatorRef = db.collection('users').doc(trade.initiatorUid);
      const initiatorSnap = await tx.get(initiatorRef);
      if (!initiatorSnap.exists) throw new HttpsError('failed-precondition', 'No character found.');
      const initiatorSave = initiatorSnap.data() as PlayerSave;

      releaseOffer(initiatorSave, trade.initiatorOffer);
      initiatorSave.updatedAt = Date.now();

      tx.set(initiatorRef, initiatorSave);
      tx.set(tradeRef, { ...trade, status: 'declined', updatedAt: Date.now() });
      tx.delete(lockRef);
      return { status: 'declined' as const };
    }

    const recipientRef = db.collection('users').doc(uid);
    const recipientSnap = await tx.get(recipientRef);
    if (!recipientSnap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const recipientSave = recipientSnap.data() as PlayerSave;

    const offer = counterOffer as TradeOfferSide;
    const validation = validateTradeOfferItems(offer.items, recipientSave.inventory, recipientSave.player.equipment);
    if (!validation.ok) throw new HttpsError('failed-precondition', validation.message ?? 'Invalid offer.');
    if (offer.gold > recipientSave.player.gold) throw new HttpsError('failed-precondition', 'Not enough gold.');

    escrowOffer(recipientSave, offer);
    recipientSave.updatedAt = Date.now();

    tx.set(recipientRef, recipientSave);
    tx.set(tradeRef, { ...trade, recipientOffer: offer, status: 'awaiting_initiator', updatedAt: Date.now() });
    return { status: 'awaiting_initiator' as const };
  });
});

interface FinalizeTradeRequest {
  tradeId: string;
  accept: boolean;
}

/** The initiator's final word once the recipient has countered - accept executes the swap,
 *  reject returns both sides' escrow. This is the first transaction in this codebase touching two
 *  different accounts' users/{uid} docs asymmetrically (every existing multi-doc transaction is
 *  either one account's own save, or a *symmetric* pair like friendships/blocks) - reads for both
 *  accounts happen via one Promise.all before any write, in the same transaction as the trade
 *  doc's own read/write, exactly as Firestore transactions require. Splitting this into two
 *  transactions would reintroduce the exact atomicity gap escrow exists to prevent - a crash
 *  between them could durably strand one side's assets. */
export const finalizeTrade = onCall<FinalizeTradeRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const tradeId = request.data?.tradeId;
  const accept = request.data?.accept;
  if (!tradeId || typeof accept !== 'boolean') throw new HttpsError('invalid-argument', 'Invalid request.');

  const db = getFirestore();
  const tradeRef = db.collection('trades').doc(tradeId);

  return db.runTransaction(async (tx) => {
    const tradeSnap = await tx.get(tradeRef);
    if (!tradeSnap.exists) throw new HttpsError('not-found', 'That trade no longer exists.');
    const trade = tradeSnap.data() as TradeDoc;
    if (trade.initiatorUid !== uid) {
      throw new HttpsError('permission-denied', 'This trade is not yours to finalize.');
    }
    if (trade.status !== 'awaiting_initiator') return { status: trade.status };
    if (!trade.recipientOffer) throw new HttpsError('internal', 'Trade is missing a counter-offer.');

    const initiatorRef = db.collection('users').doc(trade.initiatorUid);
    const recipientRef = db.collection('users').doc(trade.recipientUid);
    const lockRef = db.collection('activeTradeLocks').doc(sortedPairKey(trade.initiatorUid, trade.recipientUid));

    const [initiatorSnap, recipientSnap] = await Promise.all([tx.get(initiatorRef), tx.get(recipientRef)]);
    if (!initiatorSnap.exists || !recipientSnap.exists) {
      throw new HttpsError('failed-precondition', "A trading partner's character could not be found.");
    }
    const initiatorSave = initiatorSnap.data() as PlayerSave;
    const recipientSave = recipientSnap.data() as PlayerSave;

    if (accept) {
      mergeOfferInto(initiatorSave, trade.recipientOffer);
      mergeOfferInto(recipientSave, trade.initiatorOffer);
    } else {
      releaseOffer(initiatorSave, trade.initiatorOffer);
      releaseOffer(recipientSave, trade.recipientOffer);
    }
    initiatorSave.updatedAt = Date.now();
    recipientSave.updatedAt = Date.now();

    tx.set(initiatorRef, initiatorSave);
    tx.set(recipientRef, recipientSave);
    if (accept) {
      tx.set(tradeRef, { ...trade, status: 'accepted', updatedAt: Date.now() });
      tx.delete(lockRef);
      return { status: 'accepted' as const };
    }
    tx.set(tradeRef, { ...trade, status: 'cancelled', updatedAt: Date.now() });
    tx.delete(lockRef);
    return { status: 'cancelled' as const };
  });
});

interface CancelTradeRequest {
  tradeId: string;
}

/** Lets the initiator back out before the recipient has responded at all - once countered, the
 *  initiator's only remaining path is finalizeTrade's accept/reject, not this. */
export const cancelTrade = onCall<CancelTradeRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const tradeId = request.data?.tradeId;
  if (!tradeId) throw new HttpsError('invalid-argument', 'No trade specified.');

  const db = getFirestore();
  const tradeRef = db.collection('trades').doc(tradeId);

  return db.runTransaction(async (tx) => {
    const tradeSnap = await tx.get(tradeRef);
    if (!tradeSnap.exists) throw new HttpsError('not-found', 'That trade no longer exists.');
    const trade = tradeSnap.data() as TradeDoc;
    if (trade.initiatorUid !== uid) {
      throw new HttpsError('permission-denied', 'This trade is not yours to cancel.');
    }
    if (trade.status !== 'awaiting_recipient') return { cancelled: false, status: trade.status };

    const initiatorRef = db.collection('users').doc(trade.initiatorUid);
    const lockRef = db.collection('activeTradeLocks').doc(sortedPairKey(trade.initiatorUid, trade.recipientUid));
    const initiatorSnap = await tx.get(initiatorRef);
    if (!initiatorSnap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const initiatorSave = initiatorSnap.data() as PlayerSave;

    releaseOffer(initiatorSave, trade.initiatorOffer);
    initiatorSave.updatedAt = Date.now();

    tx.set(initiatorRef, initiatorSave);
    tx.set(tradeRef, { ...trade, status: 'cancelled', updatedAt: Date.now() });
    tx.delete(lockRef);
    return { cancelled: true, status: 'cancelled' as const };
  });
});
