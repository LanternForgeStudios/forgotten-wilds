import { describe, expect, it } from 'vitest';
import { getFirestore } from 'firebase-admin/firestore';
import { callAs, seedPlayer } from '../testUtils/firestoreTestEnv';
import { sendDirectMessage } from './sendDirectMessage';
import type { FriendshipDoc } from '../shared-types';

async function makeFriends(uidA: string, uidB: string): Promise<void> {
  const db = getFirestore();
  await Promise.all([
    db.collection('friendships').doc(uidA).set({ friendUids: [uidB] } satisfies FriendshipDoc),
    db.collection('friendships').doc(uidB).set({ friendUids: [uidA] } satisfies FriendshipDoc),
  ]);
}

describe('sendDirectMessage', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(sendDirectMessage.run({ data: { toUid: 'someone', text: 'hi' }, auth: undefined })).rejects.toThrow();
  });

  it('rejects messaging a non-friend', async () => {
    const uid = 'u-dm-not-friend';
    const toUid = 'u-dm-not-friend-target';
    await seedPlayer(uid);
    await seedPlayer(toUid);
    await expect(callAs(sendDirectMessage, uid, { toUid, text: 'hello' })).rejects.toThrow();
  });

  it('sends a message between friends', async () => {
    const uid = 'u-dm-sender';
    const toUid = 'u-dm-recipient';
    await seedPlayer(uid);
    await seedPlayer(toUid);
    await makeFriends(uid, toUid);

    const result = await callAs(sendDirectMessage, uid, { toUid, text: 'hey there' });
    expect(result.sent).toBe(true);
  });

  it('rejects an empty or whitespace-only message', async () => {
    const uid = 'u-dm-empty-sender';
    const toUid = 'u-dm-empty-recipient';
    await seedPlayer(uid);
    await seedPlayer(toUid);
    await makeFriends(uid, toUid);
    await expect(callAs(sendDirectMessage, uid, { toUid, text: '   ' })).rejects.toThrow();
  });

  it('rejects messaging a user who has blocked the sender', async () => {
    const uid = 'u-dm-blocked-sender';
    const toUid = 'u-dm-blocked-recipient';
    await seedPlayer(uid);
    await seedPlayer(toUid);
    await makeFriends(uid, toUid);
    await getFirestore()
      .collection('blocks')
      .doc(toUid)
      .set({ blockedUids: [uid] });
    await expect(callAs(sendDirectMessage, uid, { toUid, text: 'let me back in' })).rejects.toThrow();
  });

  it('applies a temporary mute after a sustained flood, independent of world chat', async () => {
    const uid = 'u-dm-flood-sender';
    const toUid = 'u-dm-flood-recipient';
    await seedPlayer(uid);
    await seedPlayer(toUid);
    await makeFriends(uid, toUid);

    // FLOOD_MESSAGE_LIMIT is 6 within FLOOD_WINDOW_MS - the shared MIN_MESSAGE_INTERVAL_MS
    // cooldown (1300ms) would reject a true machine-gun burst before the flood check ever runs,
    // so directly manipulate the moderation doc's timestamps instead of sending 7 real messages
    // 1.3s apart (which would make this test take 9+ seconds for no real benefit).
    const now = Date.now();
    await getFirestore()
      .collection('directMessageModeration')
      .doc(uid)
      .set({
        lastMessageAt: now - 2000,
        recentMessageTimestamps: [now - 9000, now - 8000, now - 7000, now - 6000, now - 5000, now - 4000],
        mutedUntil: 0,
      });

    await expect(callAs(sendDirectMessage, uid, { toUid, text: 'one too many' })).rejects.toThrow(/muted|quickly/i);

    // A separate account's DM/world chat moderation state is untouched by this account's flood.
    const otherModerationSnap = await getFirestore().collection('directMessageModeration').doc(toUid).get();
    expect(otherModerationSnap.exists).toBe(false);
  });
});
