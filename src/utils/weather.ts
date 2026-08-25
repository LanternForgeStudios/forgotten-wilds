import type { QuestProgress, WeatherKind } from '@/types';
import { REGION_WEATHER_PALETTE, STORY_WEATHER_LOCKS } from '@/data/weatherConfig';
import { isOutdoorTopLevelLocation } from '@/utils/location';

/** Resolves the ambient weather effect for a location, given the player's quest progress -
 *  see src/data/weatherConfig.ts for the palette/lock data this reads.
 *  - Dungeons and any sub-location (building interiors, same-map subareas) never get weather -
 *    returns null.
 *  - A location listed in STORY_WEATHER_LOCKS never gets random weather at all: locked weather
 *    while its quest is incomplete, 'sun' (clear) once it's done - not a fallback into
 *    REGION_WEATHER_PALETTE. The story beat is "this place stays wrong until you fix it, then
 *    it's just normal," not "wrong, then back to a random roll like everywhere else."
 *  - Every other location picks uniformly at random from REGION_WEATHER_PALETTE (falls back to
 *    'sun' if a top-level location has no palette entry, rather than throwing).
 *  `rng` defaults to Math.random but is injectable for deterministic tests. */
export function resolveWeather(
  locationId: string,
  questProgress: Record<string, QuestProgress>,
  rng: () => number = Math.random,
): WeatherKind | null {
  if (!isOutdoorTopLevelLocation(locationId)) return null;

  const lock = STORY_WEATHER_LOCKS[locationId];
  if (lock) return questProgress[lock.questId]?.status === 'completed' ? 'sun' : lock.weather;

  const palette = REGION_WEATHER_PALETTE[locationId];
  if (!palette || palette.length === 0) return 'sun';
  return palette[Math.floor(rng() * palette.length)];
}
