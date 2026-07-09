import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { buildFreshPlayer, buildFreshSaveContent } from '../engine/newCharacter';
import type { PlayerSave } from '../shared-types';

interface CreateCharacterRequest {
  name: string;
}

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 24;

function validateName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new HttpsError('invalid-argument', 'Character name is required.');
  }
  const name = raw.trim();
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    throw new HttpsError(
      'invalid-argument',
      `Character name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`,
    );
  }
  return name;
}

export const createCharacter = onCall<CreateCharacterRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to create a character.');
  }

  const name = validateName(request.data?.name);

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const directoryRef = db.collection('userDirectory').doc(uid);

  const now = Date.now();
  const save: PlayerSave = {
    displayName: name,
    createdAt: now,
    lastLoginAt: now,
    player: buildFreshPlayer(uid, name, now),
    ...buildFreshSaveContent(),
    updatedAt: now,
  };

  // Previously a plain get()-then-set() - a double-submit (double-click, or a retry after a slow/
  // timed-out first response) could fire two concurrent calls that both read existing.exists ===
  // false before either write landed, both proceed, and have the second set() silently overwrite
  // the first with a different save (e.g. a different typed name) instead of correctly rejecting
  // the second with already-exists. A transaction makes Firestore serialize the two attempts.
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(userRef);
    if (existing.exists) {
      throw new HttpsError('already-exists', 'A character already exists for this account.');
    }
    tx.set(userRef, save);
    // Public, minimal directory entry so other players can find this account by name to send a
    // friend request - deliberately excludes email/anything sensitive (see searchUsers.ts).
    tx.set(directoryRef, {
      uid,
      displayName: name,
      displayNameLower: name.toLowerCase(),
    });
  });

  return save;
});
