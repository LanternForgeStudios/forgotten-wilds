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
    'frostbound-treatise-cache': 'frostbound-treatise',
  },
  'raven-ridge': {
    'ember-codex-tunnel': 'ember-codex',
  },
  // Crimson Bayou (MSQ Volume II) - the 3 Heart Seed fragments, one per Chapter 3 field map.
  'cypress-marsh': {
    'heart-seed-cypress': 'heart-seed-cypress',
    'bogwater-almanac-cache': 'bogwater-almanac',
  },
  'murkwater-trails': {
    'heart-seed-murkwater': 'heart-seed-murkwater',
    'drowned-ledger-cache': 'drowned-ledger',
  },
  'hidden-river-landing': {
    'heart-seed-river': 'heart-seed-river',
  },
  // Temple of the Deep Current (Chapter 4 dungeon) - refId equals the granted item's own id,
  // matching every other WORLD_ITEMS entry's convention.
  'temple-of-the-deep-current': {
    'temple-records': 'temple-records',
    'lantern-of-still-waters': 'lantern-of-still-waters',
  },
  // Endless Prairie (MSQ Volume III) - the 3 Wind Stone fragments, one per Chapter 5 field map,
  // plus the 2 hidden Winter Count hides for the region's own side quest (The Winter Counts).
  'golden-prairie': {
    'wind-stone-golden-prairie': 'wind-stone-golden-prairie',
    'winter-count-hide-i-cache': 'winter-count-hide-i',
  },
  'spirit-herd-plains': {
    'wind-stone-spirit-herd-plains': 'wind-stone-spirit-herd-plains',
    'winter-count-hide-ii-cache': 'winter-count-hide-ii',
  },
  'stone-circle-valley': {
    'wind-stone-stone-circle-valley': 'wind-stone-stone-circle-valley',
  },
  // Endless Prairie (MSQ Volume III, Chapter 6) - the Lantern of Open Skies, found in the
  // Thunderbird Mesa dungeon's Lantern Sanctuary room (MSF-EP-007).
  'lantern-sanctuary': {
    'lantern-of-open-skies': 'lantern-of-open-skies',
  },
  // Whispering Pines (MSQ Volume IV, Chapter 7) - the 3 Spirit Seed fragments (MSF-WP-003) plus
  // the Lost Library's recovered records (MSF-WP-004).
  'elder-forest': {
    'spirit-seed-elder-forest': 'spirit-seed-elder-forest',
  },
  'silver-river': {
    'spirit-seed-silver-river': 'spirit-seed-silver-river',
  },
  'heartwood-approach': {
    'spirit-seed-heartwood-approach': 'spirit-seed-heartwood-approach',
    'lost-library-records': 'lost-library-records',
  },
  // Whispering Pines side quest (docs/Mytherra-SQ_breakdown.md wasn't pre-populated for this
  // region - "The Heartwood Recordings" written fresh, same "Winter Counts" shape) - 2 hidden
  // caches, one per part.
  'mistwood-path': {
    'heartwood-recording-i-cache': 'heartwood-recording-i',
  },
  'ancient-cedar-shrine': {
    'heartwood-recording-ii-cache': 'heartwood-recording-ii',
  },
  // Whispering Pines (MSQ Volume IV, Chapter 8) - the Archive Fragments (MSF-WP-006) and the
  // Lantern of Ancient Roots' found-item form (MSF-WP-007).
  'inner-archive': {
    'archive-fragments': 'archive-fragments',
  },
  'heartwood-lantern-sanctuary': {
    'lantern-of-ancient-roots': 'lantern-of-ancient-roots',
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
  'cypress-marsh': new Set(['mother-cypress-shrine']),
  'stone-circle-valley': new Set(['stone-circle-carvings']),
  // Endless Prairie (MSQ Volume III, Chapter 6) - Summit Temple's own restoration beat (MSF-EP-006).
  'summit-temple': new Set(['ancient-wind-mechanism']),
  // Whispering Pines (MSQ Volume IV, Chapter 7) - the Ancient Cedar Shrine's own investigate
  // (MSF-WP-002) then restore (MSF-WP-003) beats share this same refId, matching the established
  // shrine-reuse-across-sequential-quests pattern (Mother Cypress Shrine, Stone Circle Carvings).
  'ancient-cedar-shrine': new Set(['cedar-shrine-heart']),
  // Heartwood Sanctuary's outer gate mechanism (MSF-WP-005) - foreshadows Chapter 8's dungeon.
  'heartwood-approach': new Set(['heartwood-sanctuary-gate']),
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
  'mother-cypress-shrine': 'cypress-marsh',
};
