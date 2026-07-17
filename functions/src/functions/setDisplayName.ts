import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 24;
const NAME_PATTERN = /^[A-Za-z0-9_]+$/;

function validateDisplayName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new HttpsError('invalid-argument', 'A name is required.');
  }
  const name = raw.trim();
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    throw new HttpsError('invalid-argument', `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`);
  }
  if (!NAME_PATTERN.test(name)) {
    throw new HttpsError('invalid-argument', 'Name can only contain letters, numbers, and underscores.');
  }
  return name;
}

interface SetDisplayNameRequest {
  name: string;
}

/** Renames the caller's character/display name - updates both name fields (see the doc comments
 *  on PlayerSave.displayName and Player.name in shared-types/index.ts for why there are two) plus
 *  the denormalized userDirectory entry search/friends/clan all read from, all in one transaction.
 *  Uniqueness (case-insensitive) is the one value-based transactional check in this codebase -
 *  every other uniqueness check here (friendRequests, activeTradeLocks, clanInvites) uses a
 *  deterministic doc id instead, because a display name has no natural id to derive one from.
 *  Firestore still evaluates a query read inside a transaction atomically alongside the other
 *  reads, so this is just as race-free as those. */
export const setDisplayName = onCall<SetDisplayNameRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const name = validateDisplayName(request.data?.name);
  const nameLower = name.toLowerCase();

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const directoryRef = db.collection('userDirectory').doc(uid);

  return db.runTransaction(async (tx) => {
    const dupQuery = db.collection('userDirectory').where('displayNameLower', '==', nameLower);
    const [userSnap, dupSnap] = await Promise.all([tx.get(userRef), tx.get(dupQuery)]);
    if (!userSnap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    if (dupSnap.docs.some((d) => d.id !== uid)) {
      throw new HttpsError('already-exists', 'That name is already taken.');
    }

    const save = userSnap.data() as PlayerSave;
    save.displayName = name;
    save.player.name = name;
    save.updatedAt = Date.now();
    tx.set(userRef, save);
    // merge: true - a plain tx.set here would silently overwrite this doc's highestEndlessWave
    // (added later than displayName/displayNameLower) back to nothing, since Firestore's set()
    // without merge replaces the whole document rather than patching just these fields.
    tx.set(directoryRef, { uid, displayName: name, displayNameLower: nameLower }, { merge: true });

    return { displayName: name };
  });
});
