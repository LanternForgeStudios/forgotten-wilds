import type { WorldChatModerationDoc } from '../shared-types';

/** Cheap machine-gun-spam guard - reject a message sent this soon after the previous one,
 *  checked as a single timestamp (no array needed) the same way dash.ts's DASH_COOLDOWN_MS
 *  cooldown does. Loose enough that normal typing speed never trips it. */
export const MIN_MESSAGE_INTERVAL_MS = 1300;
/** Sustained-flood detection window and limit - more than FLOOD_MESSAGE_LIMIT messages inside
 *  FLOOD_WINDOW_MS applies a temp mute. 6/10s is loose enough that a fast typist doing a genuine
 *  multi-message thought doesn't trip it, while still catching a real flood. */
export const FLOOD_WINDOW_MS = 10_000;
export const FLOOD_MESSAGE_LIMIT = 6;
export const TEMP_MUTE_MS = 5 * 60_000;

export type MessageCheckResult =
  | { allowed: true; moderation: WorldChatModerationDoc }
  | { allowed: false; reason: string; moderation: WorldChatModerationDoc };

/** The whole flood-control decision, in one pure function: given the sender's current moderation
 *  state and the current time, decide whether this message is allowed, and what the moderation
 *  doc should become either way (the caller persists whichever `moderation` comes back,
 *  including on a rejection - a newly-applied mute must still be saved). Checked in order:
 *  already-muted, too-soon-since-last-message, sustained-flood-over-the-window - the first one
 *  that fires short-circuits the rest. */
export function checkAndRecordMessage(moderation: WorldChatModerationDoc, now: number): MessageCheckResult {
  if (moderation.mutedUntil > now) {
    const remainingSeconds = Math.ceil((moderation.mutedUntil - now) / 1000);
    return {
      allowed: false,
      reason: `You're temporarily muted for ${remainingSeconds}s for sending messages too quickly.`,
      moderation,
    };
  }

  if (now - moderation.lastMessageAt < MIN_MESSAGE_INTERVAL_MS) {
    return { allowed: false, reason: "You're sending messages too quickly.", moderation };
  }

  const recentMessageTimestamps = [...moderation.recentMessageTimestamps, now].filter(
    (t) => now - t < FLOOD_WINDOW_MS,
  );

  if (recentMessageTimestamps.length > FLOOD_MESSAGE_LIMIT) {
    return {
      allowed: false,
      reason: 'Too many messages - you have been temporarily muted.',
      moderation: {
        lastMessageAt: moderation.lastMessageAt,
        recentMessageTimestamps,
        mutedUntil: now + TEMP_MUTE_MS,
      },
    };
  }

  return {
    allowed: true,
    moderation: { lastMessageAt: now, recentMessageTimestamps, mutedUntil: 0 },
  };
}
