import type { QuestProgress, WeatherKind } from '@/types';
import { LOCATIONS } from '@/data';
import { REGION_WEATHER_PALETTE, STORY_WEATHER_LOCKS } from '@/data/weatherConfig';

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
  const location = LOCATIONS.find((l) => l.id === locationId);
  if (!location || location.kind === 'dungeon' || location.parentLocationId) return null;

  const lock = STORY_WEATHER_LOCKS[locationId];
  if (lock) return questProgress[lock.questId]?.status === 'completed' ? 'sun' : lock.weather;

  const palette = REGION_WEATHER_PALETTE[locationId];
  if (!palette || palette.length === 0) return 'sun';
  return palette[Math.floor(rng() * palette.length)];
}

/** Fixed cycle order for the F8 debug hotkey (Overworld/TownScene - F9 is already the collision
 *  debug overlay toggle, see PhaserExplorationCanvas.tsx) - lets weather be tested by hand
 *  without traveling to a specific region or waiting on a random roll. 'sun' stands in for "no
 *  effect" here rather than including a separate null stop, since they render identically. */
const DEBUG_CYCLE: WeatherKind[] = ['sun', 'fog', 'rain', 'snow', 'sandstorm'];

export function cycleWeather(current: WeatherKind | null): WeatherKind {
  const index = current ? DEBUG_CYCLE.indexOf(current) : -1;
  return DEBUG_CYCLE[(index + 1) % DEBUG_CYCLE.length];
}
