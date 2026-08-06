/** Which town is "home" for a given non-town location - used by resolveCombatAction.ts's defeat
 *  handling to send the player back to the region they were actually fighting in (rather than
 *  always Ash Hallow). Kept in sync by hand with the identical table in
 *  src/utils/locationHomeTown.ts (same pattern as LOCATION_GATES). Every `town`-kind location
 *  (including building interiors) needs no entry here - combat never happens inside one anyway. */
export const LOCATION_HOME_TOWN: Record<string, string> = {
  // Iron Mountains
  'ironwood-trail': 'ash-hallow',
  'hunters-camp': 'ash-hallow',
  'spirit-grove': 'ash-hallow',
  'mossy-creek': 'ash-hallow',
  'fallen-watchtower': 'ash-hallow',
  'raven-ridge': 'ash-hallow',
  'whisper-falls': 'ash-hallow',
  'black-briar-forest': 'ash-hallow',
  'hollow-rail-mine': 'ash-hallow',
  // Crimson Bayou (MSQ Volume II)
  'cypress-marsh': 'mirehaven',
  'mother-cypress-shrine': 'mirehaven',
  'murkwater-trails': 'mirehaven',
  'hidden-river-landing': 'mirehaven',
  'temple-of-the-deep-current': 'mirehaven',
  // Endless Prairie (MSQ Volume III, Chapter 5)
  'golden-prairie': 'highwind-crossing',
  'spirit-herd-plains': 'highwind-crossing',
  'sacred-hills': 'highwind-crossing',
  'stone-circle-valley': 'highwind-crossing',
  'thunderbird-mesa-approach': 'highwind-crossing',
  'stone-circle-carvings': 'highwind-crossing',
  // Endless Prairie (MSQ Volume III, Chapter 6) - Thunderbird Mesa dungeon (5 chained rooms).
  'summit-temple': 'highwind-crossing',
  'sky-bridge': 'highwind-crossing',
  'storm-galleries': 'highwind-crossing',
  'lantern-sanctuary': 'highwind-crossing',
  'guardian-peak': 'highwind-crossing',
  // Whispering Pines (MSQ Volume IV, Chapter 7)
  'mistwood-path': 'cedarwatch',
  'elder-forest': 'cedarwatch',
  'silver-river': 'cedarwatch',
  'ancient-cedar-shrine': 'cedarwatch',
  'heartwood-approach': 'cedarwatch',
  // Whispering Pines (MSQ Volume IV, Chapter 8) - Heartwood Sanctuary dungeon (4 chained rooms).
  'root-caverns': 'cedarwatch',
  'inner-archive': 'cedarwatch',
  'heartwood-lantern-sanctuary': 'cedarwatch',
  'guardian-grove': 'cedarwatch',
  // Shattered Desert (MSQ Volume V, Chapter 9).
  'sunfire-dunes': 'red-mesa',
  'crimson-canyons': 'red-mesa',
  'painted-mesas': 'red-mesa',
  'celestial-oasis': 'red-mesa',
  'forgotten-observatory-approach': 'red-mesa',
  // Shattered Desert (MSQ Volume V, Chapter 10) - Forgotten Observatory dungeon (5 chained rooms).
  'inner-observatory': 'red-mesa',
  'star-chamber': 'red-mesa',
  'star-lantern-sanctuary': 'red-mesa',
  'canyon-depths': 'red-mesa',
  'guardian-summit': 'red-mesa',
  // Frozen Frontier (MSQ Volume VI, Chapter 11).
  'snowveil-forest': 'frosthaven',
  'frozen-river': 'frosthaven',
  'glacier-pass': 'frosthaven',
  'aurora-basin': 'frosthaven',
  'hall-of-eternal-winter-approach': 'frosthaven',
};

/** Resolves the home town for any location id - falls back to Ash Hallow for an unmapped id. */
export function homeTownFor(locationId: string): string {
  return LOCATION_HOME_TOWN[locationId] ?? 'ash-hallow';
}
