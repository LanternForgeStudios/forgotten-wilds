import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';
import { ENFORCE_APP_CHECK } from '../appCheckConfig';

interface SetAudioSettingsRequest {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
}

function isVolume(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

/** Lets the player change their account-wide music/SFX mute+volume any time (see UserProfile.tsx's
 *  Settings tab) - purely a playback preference, no economy/progress implications, so no
 *  validation beyond "are these actually booleans/0-1 numbers" is needed. The client keeps its own
 *  localStorage copy as the live source of truth for actual playback and calls this on every
 *  change purely to persist it - see AudioSettings' own doc comment for the full design
 *  reasoning. */
export const setAudioSettings = onCall<SetAudioSettingsRequest>({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const { musicEnabled, sfxEnabled, musicVolume, sfxVolume } = request.data ?? {};
  if (typeof musicEnabled !== 'boolean' || typeof sfxEnabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'musicEnabled and sfxEnabled must both be booleans.');
  }
  if (!isVolume(musicVolume) || !isVolume(sfxVolume)) {
    throw new HttpsError('invalid-argument', 'musicVolume and sfxVolume must both be numbers between 0 and 1.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    save.player.audioSettings = { musicEnabled, sfxEnabled, musicVolume, sfxVolume };
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { musicEnabled, sfxEnabled, musicVolume, sfxVolume };
  });
});
