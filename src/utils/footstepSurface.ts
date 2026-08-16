import { LOCATIONS } from '@/data';

/** Matches the 4 surfaces the Free Fantasy SFX Pack's footstep set actually covers (see
 *  docs/Audio-Usage-Tracker.md) - not a general-purpose terrain taxonomy, just what footstep
 *  audio exists for. */
export type FootstepSurface = 'dirt' | 'stone' | 'water' | 'wood';

// Crimson Bayou (MSQ Volume II) - the one swamp/wetland region, everything else overworld
// defaults to 'dirt' below.
const WATER_LOCATION_IDS = new Set(['cypress-marsh', 'mother-cypress-shrine', 'murkwater-trails', 'hidden-river-landing']);

// Shattered Desert (canyon/rock) and Frozen Frontier (ice/rock) - closer to a hard "stone" step
// than a soft "dirt" one; the footstep pack has no dedicated sand or snow variant.
const STONE_LOCATION_IDS = new Set([
  'sunfire-dunes',
  'crimson-canyons',
  'painted-mesas',
  'celestial-oasis',
  'forgotten-observatory-approach',
  'snowveil-forest',
  'frozen-river',
  'glacier-pass',
  'aurora-basin',
  'hall-of-eternal-winter-approach',
]);

/** Which footstep surface to play while walking/dashing through a given location - by `kind`
 *  first (every dungeon is 'stone', every town building interior is 'wood', every town square is
 *  'dirt'), then by region for the overworld (forest/plains regions default to 'dirt'; the swamp
 *  and desert/tundra regions override to 'water'/'stone' above). Assigned per-location rather
 *  than per-tile - simpler, and the 4-surface footstep pack isn't fine-grained enough to reward
 *  real per-tile terrain lookup anyway. Falls back to 'dirt' for an unknown locationId. */
export function footstepSurfaceFor(locationId: string): FootstepSurface {
  const location = LOCATIONS.find((l) => l.id === locationId);
  if (!location) return 'dirt';
  if (location.kind === 'dungeon') return 'stone';
  if (location.kind === 'town') return location.parentLocationId ? 'wood' : 'dirt';
  if (WATER_LOCATION_IDS.has(locationId)) return 'water';
  if (STONE_LOCATION_IDS.has(locationId)) return 'stone';
  return 'dirt';
}
