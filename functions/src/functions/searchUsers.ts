import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

interface SearchUsersRequest {
  query: string;
}

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

/** Prefix search by display name only - deliberately not by email, so this can't be used to
 *  confirm/harvest account emails. Returns at most 10 matches, excluding the caller themself. */
export const searchUsers = onCall<SearchUsersRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const raw = request.data?.query;
  const query = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (query.length < MIN_QUERY_LENGTH) {
    throw new HttpsError('invalid-argument', `Enter at least ${MIN_QUERY_LENGTH} characters.`);
  }

  const db = getFirestore();
  const snap = await db
    .collection('userDirectory')
    .orderBy('displayNameLower')
    .startAt(query)
    .endAt(query + '')
    .limit(MAX_RESULTS)
    .get();

  const results = snap.docs
    .map((d) => d.data() as { uid: string; displayName: string })
    .filter((entry) => entry.uid !== uid)
    .map((entry) => ({ uid: entry.uid, displayName: entry.displayName }));

  return { results };
});
