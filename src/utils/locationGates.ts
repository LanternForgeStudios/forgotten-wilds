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
  // Crimson Bayou is unlocked entirely by Iron Mountains' own finale (MSF-IM-012) - the same
  // single-gate-per-region-entry-point model as Iron Mountains' own 'ironwood-trail', not a
  // separate gate per field map (MSF-CB-002 sends the player to all three in any order).
  mirehaven: 'the-mountain-remembers',
  'cypress-marsh': 'the-mountain-remembers',
  'murkwater-trails': 'the-mountain-remembers',
  'hidden-river-landing': 'the-mountain-remembers',
  'temple-of-the-deep-current': 'beneath-still-waters',
  // Endless Prairie (MSQ Volume III) - was missing entirely until Chapter 6's build found the gap
  // (see functions/src/functions/enterLocation.ts's matching comment for detail).
  'highwind-crossing': 'the-waters-remember',
  'thunderbird-mesa-approach': 'the-stone-circles',
  // Each multi-room dungeon's interior rooms are gated on the same quest as their chain's entry
  // room below - see functions/src/functions/enterLocation.ts's matching comment for why (closes a
  // real gap: a raw enterLocation call naming an interior room id had no gate at all otherwise). A
  // legitimate player reaching an interior room already holds this same quest, so nothing changes
  // for them here.
  'summit-temple': 'climbing-thunderbird-mesa',
  'sky-bridge': 'climbing-thunderbird-mesa',
  'storm-galleries': 'climbing-thunderbird-mesa',
  'lantern-sanctuary': 'climbing-thunderbird-mesa',
  'guardian-peak': 'climbing-thunderbird-mesa',
  'cedarwatch': 'the-first-promise-remembered',
  'root-caverns': 'heartwood-sanctuary',
  'inner-archive': 'heartwood-sanctuary',
  'heartwood-lantern-sanctuary': 'heartwood-sanctuary',
  'guardian-grove': 'heartwood-sanctuary',
  'red-mesa': 'the-missing-pages',
  'inner-observatory': 'the-path-of-the-astronomers',
  'star-chamber': 'the-path-of-the-astronomers',
  'star-lantern-sanctuary': 'the-path-of-the-astronomers',
  'canyon-depths': 'the-path-of-the-astronomers',
  'guardian-summit': 'the-path-of-the-astronomers',
  'frosthaven': 'the-stars-never-lied',
  'hall-of-eternal-winter': 'hall-of-eternal-winter',
  'winter-lantern-sanctuary': 'hall-of-eternal-winter',
  'guardian-chamber': 'hall-of-eternal-winter',
  'summit-of-winter': 'hall-of-eternal-winter',
  'hall-of-memories': 'hall-of-eternal-winter',
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
