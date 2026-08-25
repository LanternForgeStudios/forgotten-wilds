import { LOCATIONS } from '@/data';

/** Shared by src/utils/weather.ts and the lighting system - "is this a real outdoor top-level
 *  location" (never a dungeon, never a sub-location - a building interior or a same-map subarea
 *  like Spirit Grove, both of which carry parentLocationId). Factored out so weather and day/night
 *  lighting can't drift on what "applies to towns/overworlds only" actually means. */
export function isOutdoorTopLevelLocation(locationId: string): boolean {
  const location = LOCATIONS.find((l) => l.id === locationId);
  return !!location && location.kind !== 'dungeon' && !location.parentLocationId;
}
