import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import type { WorldChatMessage } from '@/types';
import { db } from './firebaseConfig';

const ONE_HOUR_MS = 60 * 60_000;
/** How often the live subscription re-queries with a fresh cutoff. The query's `where('sentAt',
 *  '>', cutoff)` captures `cutoff` once, at query-construction time - Firestore doesn't re-
 *  evaluate it as real time passes, so a tab left open for a long session would otherwise keep
 *  matching messages well past the 1-hour mark until something else (a new message, a manual
 *  refresh) forced a fresh query. Deletions from the server's own auto-purge *do* correctly
 *  deliver "removed" events to an open listener, so this isn't about stranded messages - just
 *  about a stale initial cutoff for anything that was already >1hr old before the server's own
 *  (throttled, lazy) purge got around to deleting it. */
const RESUBSCRIBE_INTERVAL_MS = 60_000;

/** Set once, the first time this module's subscribe function is ever called in this page load -
 *  "only see messages from the point in time you logged in," not "from whenever you last opened
 *  the chat panel," so closing and reopening the panel within the same session must not reset it. */
let sessionJoinedAt: number | null = null;

export function getWorldChatSessionJoinedAt(): number {
  if (sessionJoinedAt === null) sessionJoinedAt = Date.now();
  return sessionJoinedAt;
}

/** Read-only subscription - every write to worldChatMessages goes through the
 *  sendWorldChatMessage Cloud Function (see firestore.rules), so the client never mutates it
 *  directly. Callers should further filter to `m.sentAt >= getWorldChatSessionJoinedAt()` for
 *  display - this only bounds the query to the last hour, it doesn't apply the join-time cutoff
 *  itself, since a message sent 5 minutes ago (before I joined) is still real chat history other
 *  players should see. */
export function subscribeToWorldChat(callback: (messages: WorldChatMessage[]) => void): () => void {
  let unsubscribeSnapshot: (() => void) | null = null;

  function resubscribe() {
    unsubscribeSnapshot?.();
    const cutoff = Date.now() - ONE_HOUR_MS;
    const q = query(collection(db, 'worldChatMessages'), where('sentAt', '>', cutoff), orderBy('sentAt'));
    unsubscribeSnapshot = onSnapshot(q, (snap) => callback(snap.docs.map((d) => d.data() as WorldChatMessage)));
  }

  resubscribe();
  const intervalId = window.setInterval(resubscribe, RESUBSCRIBE_INTERVAL_MS);

  return () => {
    window.clearInterval(intervalId);
    unsubscribeSnapshot?.();
  };
}
