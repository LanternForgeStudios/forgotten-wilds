import { useEffect, useState } from 'react';
import { Panel } from './common/Panel';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
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
} from '@/firebase/functionsClient';
import type { DirectMessage, FriendRequest } from '@/types';
import styles from './UserProfile.module.css';

interface UserProfileProps {
  onClose: () => void;
}

type ProfileTab = 'profile' | 'friends' | 'clan' | 'reset';

export function UserProfile({ onClose }: UserProfileProps) {
  const [tab, setTab] = useState<ProfileTab>('profile');
  const authUser = useAuthStore((s) => s.user);
  const player = usePlayerStore((s) => s.player);
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
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, tab]);

  useEffect(() => {
    const allUids = [...friendUids, ...blockedUids, ...incoming.map((r) => r.fromUid), ...outgoing.map((r) => r.toUid)];
    const unresolved = Array.from(new Set(allUids)).filter((u) => !names[u]);
    if (unresolved.length === 0) return;
    resolveDisplayNames(unresolved).then((resolved) => setNames((prev) => ({ ...prev, ...resolved })));
  }, [friendUids, blockedUids, incoming, outgoing, names]);

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

  async function sendDm() {
    const text = dmDraft.trim();
    if (!text || !activeDmUid || busy) return;
    setBusy(true);
    try {
      await callSendDirectMessage(activeDmUid, text);
      setDmDraft('');
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
              {friendUids.map((fUid) => (
                <div key={fUid} className={styles.row}>
                  <span className={styles.rowName}>{names[fUid] ?? '...'}</span>
                  <button
                    className={styles.smallButton}
                    disabled={busy}
                    onClick={() => setActiveDmUid((cur) => (cur === fUid ? null : fUid))}
                  >
                    Message
                  </button>
                  <button className={styles.smallButton} disabled={busy} onClick={() => remove(fUid)}>
                    Remove
                  </button>
                  <button className={styles.dangerButton} disabled={busy} onClick={() => block(fUid)}>
                    Block
                  </button>
                </div>
              ))}
            </div>

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
