import type { QuestProgress } from '@/types';

/** Which completed quest unlocks travel into a given region - kept in sync by hand with the
 *  server-side copy in functions/src/functions/enterLocation.ts (same pattern as SHOP_CATALOGS).
 *  Chosen to avoid circular quest-prerequisite deadlocks given the fixed linear map chain
 *  (Ironwood Trail -> Raven Ridge -> Whisper Falls -> Black Briar Forest -> Hollow Rail Mine):
 *  gating Raven Ridge/Whisper Falls on the later 'rekindling-spirit-grove' would deadlock, since
 *  Whisper Falls' Water Fragment must be gathered *before* that quest; gating Hollow Rail Mine on
 *  'beneath-hollow-rail' (whose own objective is "reach the mine") would be circular too - each
 *  gate here is the latest quest that's safely completed *before* the location is ever needed.
 *  Black Briar Forest is intentionally absent - it's optional/unlocked, matching the MSQ's own
 *  "locked for MSQ, explorable later" note (i.e. not gated at all in this game). */
export const LOCATION_GATES: Record<string, string> = {
  'ironwood-trail': 'the-first-flame',
  'raven-ridge': 'the-forgotten-shrine',
  'whisper-falls': 'the-forgotten-shrine',
  'hollow-rail-mine': 'shadows-on-raven-ridge',
};

/** Returns a player-facing message if `locationId` is gated and not yet unlocked, or null if it's
 *  free to enter. Deliberately vague about which quest is required, matching the existing
 *  lore-toned "Perhaps it will mean something, in time" style elsewhere in these scenes. */
export function getBlockedMessage(locationId: string, progress: Record<string, QuestProgress>): string | null {
  const requiredQuestId = LOCATION_GATES[locationId];
  if (!requiredQuestId) return null;
  if (progress[requiredQuestId]?.status === 'completed') return null;
  return "The way isn't open to you yet. Perhaps there's more to do first.";
}
