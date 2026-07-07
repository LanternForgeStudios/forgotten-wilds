import { useEffect, useState } from 'react';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useAuthStore } from '@/state/useAuthStore';
import { useWorldStateStore } from '@/state/useWorldStateStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNow } from '@/hooks/useNow';
import { HUD_BAR_HEIGHT } from '@/hooks/useExplorationViewport';
import { subscribeToPresence } from '@/firebase/presenceService';
import { subscribeToIncomingFriendRequests, subscribeToAllDirectMessages } from '@/firebase/socialService';
import { CharacterStats } from './CharacterStats';
import { UserProfile } from './UserProfile';
import { XP_THRESHOLDS, LOCATIONS } from '@/data';
import { predictedStamina } from '@/utils/staminaRegen';
import type { DirectMessage, FriendRequest, OnlinePresence } from '@/types';
import styles from './PlayerHUD.module.css';

const STALE_AFTER_MS = 60_000;
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
  const isMobile = useIsMobile();
  const [presences, setPresences] = useState<OnlinePresence[]>([]);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [allMessages, setAllMessages] = useState<DirectMessage[]>([]);
  // Ticks the HUD every quarter-second purely so the Stamina bar visibly climbs back up in real
  // time between Dash calls instead of only updating right after one - display-only, never
  // persisted (see predictedStamina).
  const now = useNow(250);

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
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const hasNewSocial =
    incomingRequests.some((r) => r.createdAt > lastReviewedSocialAt) ||
    allMessages.some((m) => m.fromUid !== uid && m.sentAt > lastReviewedSocialAt);

  if (!player) return null;

  const hpPct = Math.max(0, Math.min(100, (player.stats.hp / player.stats.maxHp) * 100));
  const spiritPct = Math.max(0, Math.min(100, (player.stats.spirit / player.stats.maxSpirit) * 100));
  const oilPct =
    player.stats.maxLanternOil > 0
      ? Math.max(0, Math.min(100, (player.stats.lanternOil / player.stats.maxLanternOil) * 100))
      : 0;
  const barHeight = isMobile ? HUD_BAR_HEIGHT.mobile : HUD_BAR_HEIGHT.desktop;
  const xp = xpProgress(player.xp, player.level);
  const xpPct = xp ? Math.max(0, Math.min(100, (xp.intoLevel / xp.span) * 100)) : 100;

  const displayedStamina =
    player.stats.maxStamina > 0
      ? Math.round(predictedStamina(player.stats.stamina, player.stats.maxStamina, player.staminaUpdatedAt, now))
      : 0;
  const visiblePresences = locationId
    ? presences
        .filter((p) => p.locationId === locationId && now - p.lastHeartbeat < STALE_AFTER_MS)
        .sort((a, b) => a.joinedAt - b.joinedAt)
    : [];
  const locationName = locationId ? LOCATIONS.find((l) => l.id === locationId)?.name : undefined;

  return (
    <div className={styles.bar} style={{ height: barHeight }}>
      <button className={styles.name} onClick={() => setProfileOpen(true)} title="View your user profile">
        {player.name} <span className={styles.level}>Lv.{player.level}</span>
        {hasNewSocial && <span className={styles.socialBadge} title="New friend request or message" />}
      </button>

      {locationName && <span className={styles.location}>{locationName}</span>}

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

      <span className={styles.gold}>{player.gold}g</span>

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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {statsOpen && <CharacterStats onClose={() => setStatsOpen(false)} />}
      {profileOpen && <UserProfile onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
