import { useEffect, useRef, useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { signOutUser } from '@/firebase/auth';
import { getAssetUrl } from '@/assets/assetManager';
import {
  subscribeToFriendship,
  subscribeToBlockList,
  subscribeToIncomingFriendRequests,
  subscribeToOutgoingFriendRequests,
  subscribeToDirectMessagesWith,
  resolveDisplayNames,
} from '@/firebase/socialService';
import {
  callSearchUsers,
  callSendFriendRequest,
  callRespondToFriendRequest,
  callRemoveFriend,
  callBlockUser,
  callUnblockUser,
  callSendDirectMessage,
  callResetPlayerProgress,
  callMarkSocialReviewed,
  callProposeTrade,
  callRespondToTradeOffer,
  callFinalizeTrade,
  callCancelTrade,
  callSetPlayerSkin,
} from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { subscribeToPresence } from '@/firebase/presenceService';
import { subscribeToMyTrades } from '@/firebase/tradeService';
import { useNow } from '@/hooks/useNow';
import { isPresenceOnline } from '@/utils/presence';
import { useToastStore } from '@/state/useToastStore';
import { useAudioSettingsStore } from '@/state/useAudioSettingsStore';
import { TradeOfferPanel } from './TradeOfferPanel';
import { ITEMS, EQUIPMENT } from '@/data';
import type { DirectMessage, FriendRequest, OnlinePresence, TradeDoc, TradeOfferSide } from '@/types';
import styles from './UserProfile.module.css';

function tradeItemDisplayName(itemId: string): string {
  return EQUIPMENT.find((e) => e.id === itemId)?.name ?? ITEMS.find((i) => i.id === itemId)?.name ?? itemId.replace(/-/g, ' ');
}

/** "2x Healing Poultice, 3x Lantern Oil, 30g" / "nothing" for an empty offer (a legitimate
 *  counter, e.g. "take it for free"). */
function formatTradeOffer(offer: TradeOfferSide): string {
  const parts = offer.items.map((i) => `${i.quantity}x ${tradeItemDisplayName(i.itemId)}`);
  if (offer.gold > 0) parts.push(`${offer.gold}g`);
  return parts.length > 0 ? parts.join(', ') : 'nothing';
}

interface UserProfileProps {
  onClose: () => void;
}

type ProfileTab = 'profile' | 'friends' | 'clan' | 'skin' | 'settings' | 'reset';

const SKIN_OPTIONS: { id: 'male' | 'female'; label: string; assetId: string }[] = [
  { id: 'male', label: 'Male', assetId: 'sprite.player.male' },
  { id: 'female', label: 'Female', assetId: 'sprite.player.female' },
];

export function UserProfile({ onClose }: UserProfileProps) {
  const [tab, setTab] = useState<ProfileTab>('profile');
  const authUser = useAuthStore((s) => s.user);
  const player = usePlayerStore((s) => s.player);
  const audioSettings = useAudioSettingsStore();
  useOverlayClose(onClose);

  const uid = authUser?.uid;
  const email = authUser?.email ?? null;
  const memberSince = authUser?.metadata.creationTime
    ? new Date(authUser.metadata.creationTime).toLocaleDateString()
    : 'Unknown';

  // --- Friends tab state ---
  const [friendUids, setFriendUids] = useState<string[]>([]);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ uid: string; displayName: string }[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeDmUid, setActiveDmUid] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmDraft, setDmDraft] = useState('');
  const [dmError, setDmError] = useState<string | null>(null);
  const [presences, setPresences] = useState<OnlinePresence[]>([]);
  // Only needs to be fresh enough to catch a friend going stale/coming back - not the 250ms tick
  // PlayerHUD's live Stamina bar needs.
  const now = useNow(5000);
  const [myTrades, setMyTrades] = useState<TradeDoc[]>([]);
  const [tradeProposalToUid, setTradeProposalToUid] = useState<string | null>(null);
  const [counterTradeId, setCounterTradeId] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const prevTradesRef = useRef<TradeDoc[]>([]);
  const hasLoadedTradesRef = useRef(false);

  // --- Reset Progress tab state ---
  const [confirmEmail, setConfirmEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (!uid || tab !== 'friends') return;
    const unsubs = [
      subscribeToFriendship(uid, setFriendUids),
      subscribeToBlockList(uid, setBlockedUids),
      subscribeToIncomingFriendRequests(uid, setIncoming),
      subscribeToOutgoingFriendRequests(uid, setOutgoing),
      subscribeToPresence(setPresences),
      subscribeToMyTrades(uid, setMyTrades),
    ];
    // Clears the "new social activity" badge in PlayerHUD - fire-and-forget, then resync so the
    // updated lastReviewedSocialAt actually reaches the store (no live listener on users/{uid}).
    callMarkSocialReviewed()
      .then(() => resyncSave(uid))
      .catch(() => {
        // Non-critical (just clears a notification badge) - the Friends tab itself still works.
      });
    return () => unsubs.forEach((u) => u());
  }, [uid, tab]);

  useEffect(() => {
    const allUids = [
      ...friendUids,
      ...blockedUids,
      ...incoming.map((r) => r.fromUid),
      ...outgoing.map((r) => r.toUid),
      ...myTrades.flatMap((t) => t.participants),
    ];
    const unresolved = Array.from(new Set(allUids)).filter((u) => !names[u]);
    if (unresolved.length === 0) return;
    resolveDisplayNames(unresolved).then((resolved) => setNames((prev) => ({ ...prev, ...resolved })));
  }, [friendUids, blockedUids, incoming, outgoing, myTrades, names]);

  // Pushes one toast the moment a trade transitions into a terminal status - same idea as
  // hydrate.ts's toastQuestChanges, but implemented locally here since trades aren't part of
  // PlayerSave (no live listener there to diff against). Terminal trades are filtered out of the
  // Active Trades list right after (see the render below), so this is the one place their
  // outcome is ever surfaced. Requires a *previously-seen, non-terminal* version of the trade to
  // exist before toasting - otherwise the very first subscription delivery (which can already
  // include old terminal trades from a while back) would spam a toast for every one of them.
  useEffect(() => {
    const prev = prevTradesRef.current;
    if (hasLoadedTradesRef.current) {
      for (const trade of myTrades) {
        const prevTrade = prev.find((t) => t.id === trade.id);
        if (!prevTrade || prevTrade.status === trade.status) continue;
        if (prevTrade.status !== 'awaiting_recipient' && prevTrade.status !== 'awaiting_initiator') continue;
        if (trade.status === 'accepted') {
          const mine = trade.initiatorUid === uid ? trade.recipientOffer : trade.initiatorOffer;
          useToastStore.getState().push(`Trade completed - you received ${mine ? formatTradeOffer(mine) : 'nothing'}.`);
        } else if (trade.status === 'declined' || trade.status === 'cancelled') {
          useToastStore.getState().push('Trade ended - items and gold returned.');
        }
      }
    }
    hasLoadedTradesRef.current = true;
    prevTradesRef.current = myTrades;
  }, [myTrades, uid]);

  useEffect(() => {
    if (!uid || !activeDmUid) return;
    return subscribeToDirectMessagesWith(uid, activeDmUid, setDmMessages);
  }, [uid, activeDmUid]);

  async function search() {
    setSearchError(null);
    setSearchResults([]);
    try {
      const res = await callSearchUsers(searchQuery);
      setSearchResults(res.results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed.');
    }
  }

  async function sendRequest(toUid: string) {
    if (busy) return;
    setBusy(true);
    try {
      await callSendFriendRequest(toUid);
      setSearchResults((prev) => prev.filter((r) => r.uid !== toUid));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Could not send friend request.');
    } finally {
      setBusy(false);
    }
  }

  async function respond(requestId: string, accept: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await callRespondToFriendRequest(requestId, accept);
    } finally {
      setBusy(false);
    }
  }

  async function remove(friendUid: string) {
    if (busy) return;
    setBusy(true);
    try {
      await callRemoveFriend(friendUid);
      if (activeDmUid === friendUid) setActiveDmUid(null);
    } finally {
      setBusy(false);
    }
  }

  async function block(targetUid: string) {
    if (busy) return;
    setBusy(true);
    try {
      await callBlockUser(targetUid);
      if (activeDmUid === targetUid) setActiveDmUid(null);
    } finally {
      setBusy(false);
    }
  }

  async function unblock(targetUid: string) {
    if (busy) return;
    setBusy(true);
    try {
      await callUnblockUser(targetUid);
    } finally {
      setBusy(false);
    }
  }

  async function changeSkin(skin: 'male' | 'female') {
    if (busy) return;
    setBusy(true);
    try {
      await callSetPlayerSkin(skin);
      if (uid) await resyncSave(uid);
    } finally {
      setBusy(false);
    }
  }

  // Every trade action escrows/releases/grants items+gold on at least one account, including the
  // caller's own - resyncSave afterward is what makes the Inventory/gold the player sees update
  // immediately, same as callMarkSocialReviewed's own resync above (gold/inventory have no live
  // Firestore listener).
  async function proposeTrade(toUid: string, items: { itemId: string; quantity: number }[], gold: number) {
    if (busy) return;
    setBusy(true);
    setTradeError(null);
    try {
      await callProposeTrade(toUid, items, gold);
      if (uid) await resyncSave(uid);
      setTradeProposalToUid(null);
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : 'Could not propose that trade.');
    } finally {
      setBusy(false);
    }
  }

  async function declineTrade(tradeId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await callRespondToTradeOffer(tradeId, 'decline');
      if (uid) await resyncSave(uid);
    } finally {
      setBusy(false);
    }
  }

  async function counterTrade(tradeId: string, items: { itemId: string; quantity: number }[], gold: number) {
    if (busy) return;
    setBusy(true);
    setTradeError(null);
    try {
      await callRespondToTradeOffer(tradeId, 'counter', { items, gold });
      if (uid) await resyncSave(uid);
      setCounterTradeId(null);
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : 'Could not send that counter-offer.');
    } finally {
      setBusy(false);
    }
  }

  async function finalizeTrade(tradeId: string, accept: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await callFinalizeTrade(tradeId, accept);
      if (uid) await resyncSave(uid);
    } finally {
      setBusy(false);
    }
  }

  async function cancelTradeProposal(tradeId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await callCancelTrade(tradeId);
      if (uid) await resyncSave(uid);
    } finally {
      setBusy(false);
    }
  }

  async function sendDm() {
    const text = dmDraft.trim();
    if (!text || !activeDmUid || busy) return;
    setBusy(true);
    setDmError(null);
    try {
      await callSendDirectMessage(activeDmUid, text);
      setDmDraft('');
    } catch (err) {
      setDmError(err instanceof Error ? err.message : 'Could not send that message.');
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    setResetError(null);
    if (busy) return;
    setBusy(true);
    try {
      await callResetPlayerProgress(confirmEmail);
      setResetDone(true);
      setConfirmEmail('');
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Could not reset progress.');
    } finally {
      setBusy(false);
    }
  }

  const canReset = email !== null && confirmEmail.trim().toLowerCase() === email.toLowerCase();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <h2 className={styles.title}>User Profile</h2>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'profile' ? styles.tabActive : ''}`} onClick={() => setTab('profile')}>
            Profile
          </button>
          <button className={`${styles.tab} ${tab === 'friends' ? styles.tabActive : ''}`} onClick={() => setTab('friends')}>
            Friends
          </button>
          <button className={`${styles.tab} ${tab === 'clan' ? styles.tabActive : ''}`} onClick={() => setTab('clan')}>
            Clan
          </button>
          <button className={`${styles.tab} ${tab === 'skin' ? styles.tabActive : ''}`} onClick={() => setTab('skin')}>
            Skin
          </button>
          <button className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`} onClick={() => setTab('settings')}>
            Settings
          </button>
          <button className={`${styles.tab} ${tab === 'reset' ? styles.tabActive : ''}`} onClick={() => setTab('reset')}>
            Reset Progress
          </button>
        </div>

        {tab === 'profile' && player && (
          <div className={styles.section}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email</span>
              <span>{email ?? 'Unknown'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Character</span>
              <span>{player.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Level</span>
              <span>{player.level}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Spirit Rank</span>
              <span>{player.spiritRank}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Explorer Rank</span>
              <span>{player.explorerRank}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Member Since</span>
              <span>{memberSince}</span>
            </div>
            <button className={styles.smallButton} style={{ marginTop: 12 }} onClick={() => signOutUser()}>
              Sign out
            </button>
          </div>
        )}

        {tab === 'friends' && (
          <div className={styles.section}>
            <div className={styles.searchBar}>
              <input
                className={styles.textInput}
                placeholder="Search by character name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
              />
              <button className={styles.smallButton} onClick={search} disabled={busy}>
                Search
              </button>
            </div>
            {searchError && <p className={styles.error}>{searchError}</p>}
            {searchResults.length > 0 && (
              <div className={styles.list}>
                {searchResults.map((r) => (
                  <div key={r.uid} className={styles.row}>
                    <span className={styles.rowName}>{r.displayName}</span>
                    <button className={styles.smallButton} disabled={busy} onClick={() => sendRequest(r.uid)}>
                      Add Friend
                    </button>
                  </div>
                ))}
              </div>
            )}

            {incoming.length > 0 && (
              <>
                <h3 className={styles.sectionTitle}>Incoming Requests</h3>
                <div className={styles.list}>
                  {incoming.map((r) => (
                    <div key={r.id} className={styles.row}>
                      <span className={styles.rowName}>{r.fromDisplayName}</span>
                      <button className={styles.smallButton} disabled={busy} onClick={() => respond(r.id, true)}>
                        Accept
                      </button>
                      <button className={styles.smallButton} disabled={busy} onClick={() => respond(r.id, false)}>
                        Decline
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {outgoing.length > 0 && (
              <>
                <h3 className={styles.sectionTitle}>Outgoing Requests</h3>
                <div className={styles.list}>
                  {outgoing.map((r) => (
                    <div key={r.id} className={styles.row}>
                      <span className={styles.rowName}>{r.toDisplayName}</span>
                      <span className={styles.pendingTag}>Pending</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 className={styles.sectionTitle}>Friends</h3>
            <div className={styles.list}>
              {friendUids.length === 0 && <p className={styles.empty}>No friends yet - search above to add one.</p>}
              {friendUids.map((fUid) => {
                const online = isPresenceOnline(
                  presences.find((p) => p.uid === fUid),
                  now,
                );
                const hasActiveTrade = myTrades.some(
                  (t) =>
                    t.participants.includes(fUid) &&
                    (t.status === 'awaiting_recipient' || t.status === 'awaiting_initiator'),
                );
                return (
                  <div key={fUid} className={styles.row}>
                    <span
                      className={online ? styles.presenceDotOnline : styles.presenceDotOffline}
                      title={online ? 'Online' : 'Offline'}
                    />
                    <span className={styles.rowName}>{names[fUid] ?? '...'}</span>
                    <button
                      className={styles.smallButton}
                      disabled={busy}
                      onClick={() => setActiveDmUid((cur) => (cur === fUid ? null : fUid))}
                    >
                      Message
                    </button>
                    <button
                      className={styles.smallButton}
                      disabled={busy || hasActiveTrade}
                      title={hasActiveTrade ? 'You already have an active trade with this player.' : undefined}
                      onClick={() => setTradeProposalToUid((cur) => (cur === fUid ? null : fUid))}
                    >
                      Trade
                    </button>
                    <button className={styles.smallButton} disabled={busy} onClick={() => remove(fUid)}>
                      Remove
                    </button>
                    <button className={styles.dangerButton} disabled={busy} onClick={() => block(fUid)}>
                      Block
                    </button>
                  </div>
                );
              })}
            </div>

            {tradeProposalToUid && (
              <TradeOfferPanel
                title={`Propose a trade to ${names[tradeProposalToUid] ?? '...'}`}
                submitLabel="Send Offer"
                busy={busy}
                onSubmit={(items, gold) => proposeTrade(tradeProposalToUid, items, gold)}
                onCancel={() => setTradeProposalToUid(null)}
              />
            )}
            {tradeError && <p className={styles.error}>{tradeError}</p>}

            {myTrades.filter((t) => t.status === 'awaiting_recipient' || t.status === 'awaiting_initiator').length >
              0 && (
              <>
                <h3 className={styles.sectionTitle}>Active Trades</h3>
                <div className={styles.list}>
                  {myTrades
                    .filter((t) => t.status === 'awaiting_recipient' || t.status === 'awaiting_initiator')
                    .map((t) => {
                      const otherUid = t.initiatorUid === uid ? t.recipientUid : t.initiatorUid;
                      const otherName = names[otherUid] ?? '...';
                      const iAmInitiator = t.initiatorUid === uid;

                      if (t.status === 'awaiting_recipient' && !iAmInitiator) {
                        // I'm the recipient - decide to decline or counter.
                        return (
                          <div key={t.id} className={styles.tradePanel}>
                            <p className={styles.tradeOfferSummary}>
                              {otherName} offers: {formatTradeOffer(t.initiatorOffer)}
                            </p>
                            {counterTradeId === t.id ? (
                              <TradeOfferPanel
                                title="Your counter-offer"
                                submitLabel="Send Counter-Offer"
                                busy={busy}
                                onSubmit={(items, gold) => counterTrade(t.id, items, gold)}
                                onCancel={() => setCounterTradeId(null)}
                              />
                            ) : (
                              <div className={styles.searchBar}>
                                <button className={styles.smallButton} disabled={busy} onClick={() => setCounterTradeId(t.id)}>
                                  Counter
                                </button>
                                <button className={styles.dangerButton} disabled={busy} onClick={() => declineTrade(t.id)}>
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (t.status === 'awaiting_recipient' && iAmInitiator) {
                        // I'm the initiator, waiting on them - can still back out entirely.
                        return (
                          <div key={t.id} className={styles.tradePanel}>
                            <p className={styles.tradeOfferSummary}>
                              You offered {otherName}: {formatTradeOffer(t.initiatorOffer)}
                            </p>
                            <p className={styles.tradeStatusTag}>Waiting for {otherName} to respond...</p>
                            <button className={styles.dangerButton} disabled={busy} onClick={() => cancelTradeProposal(t.id)}>
                              Cancel
                            </button>
                          </div>
                        );
                      }

                      if (t.status === 'awaiting_initiator' && iAmInitiator && t.recipientOffer) {
                        // Their counter is in - accept or reject is the final word.
                        return (
                          <div key={t.id} className={styles.tradePanel}>
                            <p className={styles.tradeOfferSummary}>
                              You offered: {formatTradeOffer(t.initiatorOffer)}
                            </p>
                            <p className={styles.tradeOfferSummary}>
                              {otherName} countered with: {formatTradeOffer(t.recipientOffer)}
                            </p>
                            <div className={styles.searchBar}>
                              <button className={styles.smallButton} disabled={busy} onClick={() => finalizeTrade(t.id, true)}>
                                Accept
                              </button>
                              <button className={styles.dangerButton} disabled={busy} onClick={() => finalizeTrade(t.id, false)}>
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // awaiting_initiator, I'm the recipient - my counter is in, waiting on them.
                      return (
                        <div key={t.id} className={styles.tradePanel}>
                          <p className={styles.tradeOfferSummary}>
                            You offered: {t.recipientOffer ? formatTradeOffer(t.recipientOffer) : 'nothing'}
                          </p>
                          <p className={styles.tradeOfferSummary}>
                            {otherName} originally offered: {formatTradeOffer(t.initiatorOffer)}
                          </p>
                          <p className={styles.tradeStatusTag}>Waiting for {otherName}'s final decision...</p>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {activeDmUid && (
              <div className={styles.dmPanel}>
                <h3 className={styles.sectionTitle}>Message {names[activeDmUid] ?? '...'}</h3>
                <div className={styles.dmMessages}>
                  {dmMessages.length === 0 && <p className={styles.empty}>No messages yet.</p>}
                  {dmMessages.map((m) => (
                    <p key={m.id} className={m.fromUid === uid ? styles.dmMine : styles.dmTheirs}>
                      {m.text}
                    </p>
                  ))}
                </div>
                <p className={styles.tradeStatusTag}>
                  For your safety, don't share personal information (phone numbers, emails, or links) - messages
                  containing them, or offensive language, won't send.
                </p>
                {dmError && <p className={styles.error}>{dmError}</p>}
                <div className={styles.searchBar}>
                  <input
                    className={styles.textInput}
                    placeholder="Type a message..."
                    value={dmDraft}
                    onChange={(e) => setDmDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendDm()}
                  />
                  <button className={styles.smallButton} disabled={busy || !dmDraft.trim()} onClick={sendDm}>
                    Send
                  </button>
                </div>
              </div>
            )}

            {blockedUids.length > 0 && (
              <>
                <h3 className={styles.sectionTitle}>Blocked</h3>
                <div className={styles.list}>
                  {blockedUids.map((bUid) => (
                    <div key={bUid} className={styles.row}>
                      <span className={styles.rowName}>{names[bUid] ?? '...'}</span>
                      <button className={styles.smallButton} disabled={busy} onClick={() => unblock(bUid)}>
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'clan' && (
          <div className={styles.section}>
            <p className={styles.empty}>
              Clans are not yet available - a future home for a smaller, tighter-knit group than a Lodge.
            </p>
          </div>
        )}

        {tab === 'skin' && player && (
          <div className={styles.section}>
            <p style={{ fontSize: 13, opacity: 0.85, marginTop: 0 }}>
              Choose how your character appears to yourself and other players. More options may be added later.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {SKIN_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={busy}
                  onClick={() => changeSkin(option.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    background: player.skin === option.id ? 'var(--fw-accent-dim)' : 'transparent',
                    border: `1px solid ${player.skin === option.id ? 'var(--fw-accent)' : 'var(--fw-panel-border)'}`,
                    borderRadius: 6,
                    padding: '8px 14px',
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  <img
                    src={getAssetUrl(option.assetId)}
                    alt={option.label}
                    style={{ width: 72, height: 96, imageRendering: 'pixelated' }}
                  />
                  <span style={{ fontSize: 12 }}>{option.label}</span>
                  {player.skin === option.id && <span style={{ fontSize: 10, color: 'var(--fw-accent)' }}>Selected</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className={styles.section}>
            <p style={{ fontSize: 13, opacity: 0.85, marginTop: 0 }}>
              Music and sound effect preferences, saved on this device only.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={audioSettings.musicEnabled}
                    onChange={(e) => audioSettings.setMusicEnabled(e.target.checked)}
                  />
                  Music
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={audioSettings.musicVolume}
                  disabled={!audioSettings.musicEnabled}
                  onChange={(e) => audioSettings.setMusicVolume(Number(e.target.value))}
                  style={{ width: '100%', marginTop: 6 }}
                  aria-label="Music volume"
                />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={audioSettings.sfxEnabled}
                    onChange={(e) => audioSettings.setSfxEnabled(e.target.checked)}
                  />
                  Sound Effects
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={audioSettings.sfxVolume}
                  disabled={!audioSettings.sfxEnabled}
                  onChange={(e) => audioSettings.setSfxVolume(Number(e.target.value))}
                  style={{ width: '100%', marginTop: 6 }}
                  aria-label="Sound effects volume"
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'reset' && (
          <div className={styles.section}>
            <p className={styles.dangerText}>
              This permanently resets your level, gold, stats, equipment, inventory, quests, and journal back to a
              brand-new character - as if you just started. Your account, Premium Currency, friends, and messages
              are not affected. This cannot be undone.
            </p>
            {resetDone ? (
              <p className={styles.empty}>Your progress has been reset.</p>
            ) : (
              <>
                <label className={styles.infoLabel} htmlFor="confirmEmail">
                  Type your account email ({email ?? 'unknown'}) to confirm:
                </label>
                <input
                  id="confirmEmail"
                  className={styles.textInput}
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                {resetError && <p className={styles.error}>{resetError}</p>}
                <button className={styles.dangerButton} disabled={!canReset || busy} onClick={doReset}>
                  Reset My Progress
                </button>
              </>
            )}
          </div>
        )}

        <p className={styles.closeHint}>Click outside or press Esc to close</p>
      </Panel>
    </div>
  );
}
