import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { findMessageViolation } from '../engine/messageFilter';
import { checkAndRecordMessage } from '../engine/chatModerationEngine';
import type { PlayerSave, WorldChatCleanupMeta, WorldChatMessage, WorldChatModerationDoc } from '../shared-types';

const MAX_MESSAGE_LENGTH = 500;
const ONE_HOUR_MS = 60 * 60_000;
/** How often the auto-purge query is allowed to run, at most - without this, every single
 *  message would re-run a query+batch-delete, which is unnecessary Firestore cost for a
 *  best-effort maintenance operation. */
const CLEANUP_THROTTLE_MS = 5 * 60_000;
const CLEANUP_BATCH_LIMIT = 100;

/** Which locations count as "in a town" for world chat eligibility - there's no server-side
 *  concept of LocationKind at all today, so this is a new but precedented pattern: a
 *  hand-maintained id list, exactly like enterLocation.ts's KNOWN_LOCATION_IDS. Kept in sync by
 *  hand with src/data/locations.ts's `kind: 'town'` entries. */
const TOWN_LOCATION_IDS = new Set([
  'ash-hallow',
  'ash-hallow-elias-house',
  'ash-hallow-mara-shop',
  'ash-hallow-inn',
  'ash-hallow-blacksmith',
  'ash-hallow-apothecary',
  'ash-hallow-armory',
  'ash-hallow-archive',
  'ash-hallow-mine-office',
  'ash-hallow-town-hall',
]);

const EMPTY_MODERATION: WorldChatModerationDoc = { lastMessageAt: 0, recentMessageTimestamps: [], mutedUntil: 0 };

interface SendWorldChatMessageRequest {
  text: string;
}

/** Best-effort, throttled auto-purge of messages older than an hour - the project's established
 *  style for time-based state is lazy reconciliation on read/write (see dash.ts's own comment),
 *  not a scheduled function, so this runs opportunistically from inside a send call rather than
 *  on a timer. Deliberately outside the per-user transaction below: folding a single global
 *  cleanup doc into every user's send-transaction would serialize all chat sends against each
 *  other, not just per-user. A failure here must never block the message that already sent. */
async function purgeOldMessagesIfDue(db: FirebaseFirestore.Firestore): Promise<void> {
  try {
    const metaRef = db.collection('worldChatMeta').doc('cleanup');
    const metaSnap = await metaRef.get();
    const lastCleanupAt = (metaSnap.data() as WorldChatCleanupMeta | undefined)?.lastCleanupAt ?? 0;
    const now = Date.now();
    if (now - lastCleanupAt < CLEANUP_THROTTLE_MS) return;

    const staleSnap = await db
      .collection('worldChatMessages')
      .where('sentAt', '<', now - ONE_HOUR_MS)
      .limit(CLEANUP_BATCH_LIMIT)
      .get();

    const batch = db.batch();
    for (const doc of staleSnap.docs) batch.delete(doc.ref);
    batch.set(metaRef, { lastCleanupAt: now } satisfies WorldChatCleanupMeta);
    await batch.commit();
  } catch {
    // Best-effort - a purge failure this call just means slightly stale history lingers a bit
    // longer, not a reason to fail the message the player is actively trying to send.
  }
}

export const sendWorldChatMessage = onCall<SendWorldChatMessageRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const rawText = request.data?.text;
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (!text) throw new HttpsError('invalid-argument', 'Message cannot be empty.');
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError('invalid-argument', `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }
  const violation = findMessageViolation(text);
  if (violation) throw new HttpsError('invalid-argument', violation);

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const moderationRef = db.collection('worldChatModeration').doc(uid);
  const messageRef = db.collection('worldChatMessages').doc();

  // The transaction always commits its writes (including a newly-applied mute) and returns a
  // plain result - it never throws for a moderation rejection, since Firestore transactions are
  // all-or-nothing and a throw would roll back the mute write along with everything else. The
  // HttpsError (if any) is thrown after the transaction has durably committed, below.
  const result = await db.runTransaction(async (tx) => {
    const [userSnap, moderationSnap] = await Promise.all([tx.get(userRef), tx.get(moderationRef)]);
    if (!userSnap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = userSnap.data() as PlayerSave;

    if (!TOWN_LOCATION_IDS.has(save.player.currentLocationId)) {
      throw new HttpsError('failed-precondition', 'World Chat is only available while you are in a town.');
    }

    const moderation = (moderationSnap.data() as WorldChatModerationDoc | undefined) ?? EMPTY_MODERATION;
    const now = Date.now();
    const check = checkAndRecordMessage(moderation, now);
    tx.set(moderationRef, check.moderation);

    if (!check.allowed) return { allowed: false as const, reason: check.reason };

    const message: WorldChatMessage = { id: messageRef.id, uid, displayName: save.displayName, text, sentAt: now };
    tx.set(messageRef, message);
    return { allowed: true as const };
  });

  if (!result.allowed) throw new HttpsError('resource-exhausted', result.reason);

  await purgeOldMessagesIfDue(db);

  return { sent: true };
});
