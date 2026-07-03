import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { STARTING_STATS } from '../data/leveling';
import type { PlayerSave } from '../shared-types';

interface CreateCharacterRequest {
  name: string;
}

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 24;
const STARTING_LOCATION_ID = 'ash-hallow';

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
    player: {
      uid,
      name,
      level: 1,
      xp: 0,
      gold: 50,
      spiritEssence: 0,
      festivalTokens: 0,
      premiumCurrency: 0,
      stats: { ...STARTING_STATS },
      spiritRank: 'Unawakened',
      explorerRank: 'Newcomer',
      regionalReputation: 0,
      equipment: {
        weapon: null,
        armor: null,
        boots: null,
        gloves: null,
        charm: null,
        lantern: 'keepers-lantern',
        spiritTotem: null,
      },
      currentLocationId: STARTING_LOCATION_ID,
    },
    inventory: [{ itemId: 'healing-poultice', quantity: 2 }],
    quests: {},
    journal: {
      creaturesDiscovered: [],
      locationsVisited: [STARTING_LOCATION_ID],
      loreUnlocked: ['lore-great-silence', 'lore-lantern-keepers'],
      bossesDefeated: [],
    },
    updatedAt: now,
  };

  await userRef.set(save);

  return save;
});
