import type { OnlinePresence } from '@/types';

/** A presence heartbeat older than this is treated as offline/stale - matches useHeartbeat.ts's
 *  beat interval with generous slack for a missed beat or two before flipping to "away." Shared
 *  by PlayerHUD's "who's here" popover and the Friends list's online/offline dot, so both read
 *  the same threshold rather than drifting apart. */
export const PRESENCE_STALE_AFTER_MS = 60_000;

export function isPresenceOnline(presence: OnlinePresence | undefined, now: number): boolean {
  return !!presence && now - presence.lastHeartbeat < PRESENCE_STALE_AFTER_MS;
}
