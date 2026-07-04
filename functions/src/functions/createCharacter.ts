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
  const existing = await userRef.get();
  if (existing.exists) {
    throw new HttpsError('already-exists', 'A character already exists for this account.');
  }

  const now = Date.now();
  const save: PlayerSave = {
    displayName: name,
    createdAt: now,
    lastLoginAt: now,
    player: buildFreshPlayer(uid, name, now),
    ...buildFreshSaveContent(),
    updatedAt: now,
  };

  await userRef.set(save);
  // Public, minimal directory entry so other players can find this account by name to send a
  // friend request - deliberately excludes email/anything sensitive (see searchUsers.ts).
  await db.collection('userDirectory').doc(uid).set({
    uid,
    displayName: name,
    displayNameLower: name.toLowerCase(),
  });

  return save;
});
