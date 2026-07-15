// Authoritative — the client's src/data/locations.ts is a display copy only (names/descriptions).
//
// Consolidates the landmark lookup tables that used to be defined separately (and duplicated some
// of the same refId->parent-location facts) in visitLandmark.ts, interactWithShrine.ts, and
// collectWorldItem.ts. Kept as three separate exports rather than one merged shape, since each
// Cloud Function's own gating check needs a different lookup direction and this doesn't try to
// force a single schema onto three genuinely different mechanics (visit-only discovery vs.
// shrine interact-and-restore vs. one-time item pickup) - see each export's own doc comment.

/** Server-side source of truth for what a given map's world-item interactable actually grants -
 *  collectWorldItem.ts's own lookup. */
export const WORLD_ITEMS: Record<string, Record<string, string>> = {
  'hollow-rail-mine': {
    'miners-lost-lantern': 'miners-lost-lantern',
  },
  // Mossy Creek and Fallen Watchtower are landmarks within the Ironwood Trail map, not their own
  // locations, so their refId is looked up under 'ironwood-trail' here.
  'ironwood-trail': {
    'mossy-creek': 'stone-fragment',
    'fallen-watchtower': 'wind-fragment',
  },
  'whisper-falls': {
    'water-fragment': 'water-fragment',
  },
};

/** Server-side source of truth for which shrine interactables actually exist - interactWithShrine.ts's
 *  own lookup. The Guardian of Ironwood shrine (an ad hoc Stamina/Dash unlock chain built before the
 *  canonical MSQ existed) has been retired in favor of the Spirit Grove restoration shrine from the
 *  real MSQ content (see the 'rekindling-spirit-grove' quest, gated behind the three Guardian Sigil
 *  fragments). */
export const KNOWN_SHRINES: Record<string, Set<string>> = {
  'ironwood-trail': new Set(['spirit-grove']),
  'ash-hallow': new Set(['ash-hallow-shrine']),
  'hollow-rail-mine': new Set(['mine-shrine']),
};

/** Which parent map's location each landmark lives within - visitLandmark.ts's own lookup, used to
 *  confirm the player is actually there before granting anything, the same way enterLocation.ts/
 *  collectWorldItem.ts do. Landmarks are sub-areas within a larger overworld map (e.g. Spirit Grove
 *  within Ironwood Trail) - visiting one records Journal coverage and advances quests the same way
 *  arriving at a full location would, but does NOT change `player.currentLocationId` since the
 *  player never actually left the parent map. */
export const LANDMARK_PARENT_LOCATION: Record<string, string> = {
  'hunters-camp': 'ironwood-trail',
  'spirit-grove': 'ironwood-trail',
  'mossy-creek': 'ironwood-trail',
  'fallen-watchtower': 'ironwood-trail',
};
