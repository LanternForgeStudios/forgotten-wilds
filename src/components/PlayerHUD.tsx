import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useAuthStore } from '@/state/useAuthStore';
import { useWorldStateStore } from '@/state/useWorldStateStore';
import { useNow } from '@/hooks/useNow';
import { useHudBarHeight } from '@/hooks/useExplorationViewport';
import { subscribeToPresence } from '@/firebase/presenceService';
import { subscribeToIncomingFriendRequests, subscribeToAllDirectMessages, subscribeToFriendship } from '@/firebase/socialService';
import { subscribeToMyTrades } from '@/firebase/tradeService';
import { subscribeToMyActivePartyBattle } from '@/firebase/partyBattleService';
import { callSendFriendRequest, callClaimDailyChest, type DailyChestRewards } from '@/firebase/functionsClient';
import { CharacterStats } from './CharacterStats';
import { UserProfile } from './UserProfile';
import { ChestRewardReveal } from './ChestRewardReveal';
import { ActiveBattleOverlay } from './ActiveBattleOverlay';
import { XP_THRESHOLDS, LOCATIONS, CHEST_CLAIM_INTERVAL_MS, ELITE_CHEST_LEVEL_THRESHOLD } from '@/data';
import { predictedStamina } from '@/utils/staminaRegen';
import { PRESENCE_STALE_AFTER_MS } from '@/utils/presence';
import { resyncSave } from '@/state/hydrate';
import { playSound } from '@/audio/audioService';
import type { DirectMessage, FriendRequest, OnlinePresence, TradeDoc } from '@/types';
import styles from './PlayerHUD.module.css';

const MAX_LEVEL = XP_THRESHOLDS.length - 1;

/** How far into the current level `xp` is, out of what the next level requires - display-only
 *  math using the client's XP_THRESHOLDS copy, same as the "not authoritative" rule for anything
 *  that doesn't persist (this never writes anything, purely a progress readout). */
function xpProgress(xp: number, level: number) {
  if (level >= MAX_LEVEL) return null;
  const currentThreshold = XP_THRESHOLDS[level];
  const nextThreshold = XP_THRESHOLDS[level + 1];
  return {
    intoLevel: xp - currentThreshold,
    span: nextThreshold - currentThreshold,
    remaining: nextThreshold - xp,
  };
}

/** Button label for a presence-popover row's friend-request state - undefined means "not yet
 *  attempted this session" (the normal, common case). */
function friendRequestLabel(status: string | undefined): string {
  switch (status) {
    case 'sending':
      return '...';
    case 'sent':
      return 'Sent';
    case 'accepted':
      return 'Friends!';
    case 'already-pending':
      return 'Pending';
    case 'error':
      return 'Retry?';
    default:
      return 'Add';
  }
}

/** "7h 24m" - always shows both units (even "0h 5m") since a bare "5m" reads ambiguously as
 *  possibly-seconds at a glance, and this only ever needs minute precision. */
function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

interface PlayerHUDProps {
  /** Shows a "who else is here" indicator + popover for this location. Omit outside town-kind
   *  scenes (Overworld/Dungeon don't track presence). */
  locationId?: string;
}

/** Single horizontal bar docked to the top of the screen: name/level (opens the User Profile,
 *  which is also where sign-out lives now), HP/SP, gold, and who else is here (if in a town).
 *  Replaces the old stacked corner panel plus the separate TownPresencePanel so the map viewport
 *  below it can use the full remaining screen. */
export function PlayerHUD({ locationId }: PlayerHUDProps) {
  const player = usePlayerStore((s) => s.player);
  const uid = useAuthStore((s) => s.user?.uid);
  const lastReviewedSocialAt = useWorldStateStore((s) => s.lastReviewedSocialAt);
  const [presences, setPresences] = useState<OnlinePresence[]>([]);
  const [friendUids, setFriendUids] = useState<string[]>([]);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  // Per-uid result of a friend request sent from the presence popover below - keyed by target uid
  // so each row tracks its own outcome independently (sending/sent/accepted/already-pending/error),
  // same shape as UserProfile.tsx's own friend-search flow.
  const [friendRequestStatus, setFriendRequestStatus] = useState<Record<string, string>>({});
  const [chestOpen, setChestOpen] = useState(false);
  const [chestClaiming, setChestClaiming] = useState(false);
  const [chestError, setChestError] = useState<string | null>(null);
  const [chestResult, setChestResult] = useState<{ tier: 'standard' | 'elite'; rewards: DailyChestRewards } | null>(
    null,
  );
  const [allMessages, setAllMessages] = useState<DirectMessage[]>([]);
  const [myTrades, setMyTrades] = useState<TradeDoc[]>([]);
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
  // Ticks the HUD every quarter-second purely so the Stamina bar visibly climbs back up in real
  // time between Dash calls instead of only updating right after one - display-only, never
  // persisted (see predictedStamina).
  const now = useNow(250);
  const barHeight = useHudBarHeight();

  useEffect(() => {
    if (!locationId) return;
    const unsubscribe = subscribeToPresence(setPresences);
    return unsubscribe;
  }, [locationId]);

  // Always-mounted (not gated on the profile modal being open) so the "new social activity"
  // indicator can appear without the player needing to open their profile first.
  useEffect(() => {
    if (!uid) return;
    const unsubs = [
      subscribeToIncomingFriendRequests(uid, setIncomingRequests),
      subscribeToAllDirectMessages(uid, setAllMessages),
      subscribeToMyTrades(uid, setMyTrades),
      subscribeToFriendship(uid, setFriendUids),
      // Every participant in an Endless Battle or PvP fight gets shown it automatically via this
      // global subscription, not just whoever clicked "Start"/accepted the challenge - see
      // subscribeToMyActivePartyBattle's own doc comment.
      subscribeToMyActivePartyBattle(uid, setActiveBattleId),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const hasNewSocial =
    incomingRequests.some((r) => r.createdAt > lastReviewedSocialAt) ||
    allMessages.some((m) => m.fromUid !== uid && m.sentAt > lastReviewedSocialAt) ||
    myTrades.some(
      (t) =>
        t.updatedAt > lastReviewedSocialAt &&
        ((t.recipientUid === uid && t.status === 'awaiting_recipient') ||
          (t.initiatorUid === uid && t.status === 'awaiting_initiator')),
    );

  // Only the false->true edge, not "while true" - otherwise every unrelated re-render while a
  // notification is still unread would replay the ping.
  const prevHasNewSocialRef = useRef(false);
  useEffect(() => {
    if (hasNewSocial && !prevHasNewSocialRef.current) void playSound('sfx.social-ping');
    prevHasNewSocialRef.current = hasNewSocial;
  }, [hasNewSocial]);

  async function sendFriendRequestTo(toUid: string) {
    setFriendRequestStatus((prev) => ({ ...prev, [toUid]: 'sending' }));
    try {
      const { status } = await callSendFriendRequest(toUid);
      setFriendRequestStatus((prev) => ({ ...prev, [toUid]: status }));
    } catch {
      setFriendRequestStatus((prev) => ({ ...prev, [toUid]: 'error' }));
    }
  }

  async function claimChest() {
    if (chestClaiming) return;
    setChestClaiming(true);
    setChestError(null);
    try {
      const { tier, rewards } = await callClaimDailyChest();
      if (uid) await resyncSave(uid);
      setChestResult({ tier, rewards });
      setChestOpen(false);
      void playSound('sfx.chest-open');
    } catch (err) {
      setChestError(err instanceof Error ? err.message : 'Could not claim the chest.');
    } finally {
      setChestClaiming(false);
    }
  }

  if (!player) return null;

  const hpPct = Math.max(0, Math.min(100, (player.stats.hp / player.stats.maxHp) * 100));
  const spiritPct = Math.max(0, Math.min(100, (player.stats.spirit / player.stats.maxSpirit) * 100));
  const oilPct =
    player.stats.maxLanternOil > 0
      ? Math.max(0, Math.min(100, (player.stats.lanternOil / player.stats.maxLanternOil) * 100))
      : 0;
  const xp = xpProgress(player.xp, player.level);
  const xpPct = xp ? Math.max(0, Math.min(100, (xp.intoLevel / xp.span) * 100)) : 100;

  const displayedStamina =
    player.stats.maxStamina > 0
      ? Math.round(predictedStamina(player.stats.stamina, player.stats.maxStamina, player.staminaUpdatedAt, now))
      : 0;
  const visiblePresences = locationId
    ? presences
        .filter((p) => p.locationId === locationId && now - p.lastHeartbeat < PRESENCE_STALE_AFTER_MS)
        .sort((a, b) => a.joinedAt - b.joinedAt)
    : [];
  const locationName = locationId ? LOCATIONS.find((l) => l.id === locationId)?.name : undefined;

  // Display-only prediction from the already-synced save (same "no round-trip needed just to
  // show a countdown" approach as predictedStamina above) - the actual claim is always
  // re-validated server-side in claimDailyChest.ts, so this can never grant early even if the
  // client's clock is off.
  const chestTier: 'standard' | 'elite' = player.level >= ELITE_CHEST_LEVEL_THRESHOLD ? 'elite' : 'standard';
  // Defaults to 0 ("eligible immediately") for a save written before this field existed - the same
  // fallback claimDailyChest.ts applies server-side, needed here too since this display math reads
  // the field directly rather than through that backfill.
  const msSinceLastClaim = now - (player.lastChestClaimedAt ?? 0);
  const chestReady = msSinceLastClaim >= CHEST_CLAIM_INTERVAL_MS;
  const msUntilChest = CHEST_CLAIM_INTERVAL_MS - msSinceLastClaim;

  return (
    <div className={styles.bar} style={{ height: barHeight }}>
      {/* display:contents at normal widths (see .topRow) - name/location/gold/presence lay out as
          if they were direct children of .bar, identical to before this wrapper existed. Only
          becomes a real row of its own at the narrow-HUD breakpoint, guaranteeing it always ends
          up on its own line above .vitalsRow instead of leaving that to flex-wrap's ordering
          around a 100%-width sibling - the previous fix for narrow viewports was just hiding
          .location outright below 720px, which meant it never showed on mobile at all. */}
      <div className={styles.topRow}>
        <button className={styles.name} onClick={() => setProfileOpen(true)} title="View your user profile">
          {player.name} <span className={styles.level}>Lv.{player.level}</span>
          {hasNewSocial && <span className={styles.socialBadge} title="New friend request, message, or trade" />}
        </button>

        {locationName && <span className={styles.location}>{locationName}</span>}

        <span className={styles.gold}>{player.gold}g</span>

        <div className={styles.chestWrap}>
          <button
            className={`${styles.chestButton} ${chestReady ? styles.chestReady : ''}`}
            onClick={() => setChestOpen((open) => !open)}
            title="Daily Chest"
          >
            {chestReady ? 'Chest ready!' : formatCountdown(msUntilChest)}
          </button>
          {chestOpen && (
            <div className={styles.chestPopover} onMouseLeave={() => setChestOpen(false)}>
              <p className={styles.chestPopoverTitle}>{chestTier === 'elite' ? 'Elite' : 'Standard'} Chest</p>
              {chestReady ? (
                <button className={styles.chestClaimButton} disabled={chestClaiming} onClick={() => void claimChest()}>
                  {chestClaiming ? 'Opening...' : 'Claim'}
                </button>
              ) : (
                <p className={styles.chestCountdown}>Next chest in {formatCountdown(msUntilChest)}</p>
              )}
              {chestError && <p className={styles.chestError}>{chestError}</p>}
            </div>
          )}
        </div>

        {locationId && (
          <div className={styles.presenceWrap}>
            <button className={styles.presenceButton} onClick={() => setPresenceOpen((open) => !open)}>
              {visiblePresences.length} here
            </button>
            {presenceOpen && (
              <div className={styles.presencePopover} onMouseLeave={() => setPresenceOpen(false)}>
                {visiblePresences.length === 0 && <p className={styles.presenceEmpty}>No one else here right now.</p>}
                {visiblePresences.map((p) => (
                  <div key={p.uid} className={styles.presenceRow}>
                    <span className={styles.avatar}>{p.avatarSymbol}</span>
                    <span className={styles.presenceName}>
                      {p.displayName}
                      {p.uid === uid ? ' (you)' : ''}
                    </span>
                    {p.uid !== uid &&
                      (friendUids.includes(p.uid) ? (
                        <span className={styles.alreadyFriends}>Already friends</span>
                      ) : (
                        <button
                          className={styles.addFriendButton}
                          disabled={['sending', 'sent', 'accepted', 'already-pending'].includes(
                            friendRequestStatus[p.uid],
                          )}
                          onClick={() => void sendFriendRequestTo(p.uid)}
                          title="Send a friend request"
                        >
                          {friendRequestLabel(friendRequestStatus[p.uid])}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* display:contents at normal widths - these lay out as if they were direct children of
          .bar, preserving the exact same order/flow as before. Only becomes a real (wrapping)
          flex row of its own below the narrow-HUD breakpoint (see PlayerHUD.module.css and
          useHudBarHeight, which the parent scenes' padding-top must match), so the stat bars get
          a fresh full-width row below .topRow instead of squeezing alongside name/gold/presence. */}
      <div className={styles.vitalsRow}>
        <div className={styles.statGroup}>
          <span className={styles.barLabel}>HP</span>
          <div className={styles.barTrack}>
            <div className={styles.barFillHp} style={{ width: `${hpPct}%` }} />
            <span className={styles.barValue}>
              {player.stats.hp}/{player.stats.maxHp}
            </span>
          </div>
        </div>

        <div className={styles.statGroup}>
          <span className={styles.barLabel}>SP</span>
          <div className={styles.barTrack}>
            <div className={styles.barFillSpirit} style={{ width: `${spiritPct}%` }} />
            <span className={styles.barValue}>
              {player.stats.spirit}/{player.stats.maxSpirit}
            </span>
          </div>
        </div>

        <div className={styles.statGroup}>
          <span className={styles.barLabel}>Oil</span>
          <div className={styles.barTrack}>
            <div className={styles.barFillOil} style={{ width: `${oilPct}%` }} />
            <span className={styles.barValue}>
              {player.stats.lanternOil}/{player.stats.maxLanternOil}
            </span>
          </div>
        </div>

        {player.stats.maxStamina > 0 && (
          <div className={styles.statGroup}>
            <span className={styles.barLabel}>St</span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFillStamina}
                style={{ width: `${Math.max(0, Math.min(100, (displayedStamina / player.stats.maxStamina) * 100))}%` }}
              />
              <span className={styles.barValue}>
                {displayedStamina}/{player.stats.maxStamina}
              </span>
            </div>
          </div>
        )}

        <button
          className={`${styles.statGroup} ${styles.xpButton}`}
          onClick={() => setStatsOpen(true)}
          title="View character stats"
        >
          <span className={styles.barLabel}>XP</span>
          <div className={styles.barTrack}>
            <div className={styles.barFillXp} style={{ width: `${xpPct}%` }} />
            <span className={`${styles.barValue} ${styles.xpValue}`}>
              {xp ? `${xp.remaining} to Lv.${player.level + 1}` : 'MAX'}
            </span>
          </div>
        </button>
      </div>

      {statsOpen && <CharacterStats onClose={() => setStatsOpen(false)} />}
      {profileOpen && <UserProfile onClose={() => setProfileOpen(false)} />}
      {chestResult && (
        <ChestRewardReveal tier={chestResult.tier} rewards={chestResult.rewards} onClose={() => setChestResult(null)} />
      )}
      {activeBattleId && <ActiveBattleOverlay battleId={activeBattleId} onClose={() => setActiveBattleId(null)} />}
    </div>
  );
}
