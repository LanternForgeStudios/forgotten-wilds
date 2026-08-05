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
};

/** Resolves the home town for any location id - falls back to Ash Hallow for an unmapped id. */
export function homeTownFor(locationId: string): string {
  return LOCATION_HOME_TOWN[locationId] ?? 'ash-hallow';
}
