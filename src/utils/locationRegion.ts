import { LOCATIONS } from '@/data';

/** LOCATIONS is authored as one contiguous block per region (confirmed by the region-header
 *  comments in src/data/locations.ts) - rather than hand-transcribing every location id into a
 *  second id->region table (the exact "silently goes stale the moment new content ships" bug
 *  pattern found repeatedly elsewhere in this codebase), a region is derived from which of these
 *  known block-starting ids comes last at-or-before a given location's own array position. */
const REGION_START_IDS: { regionName: string; startId: string }[] = [
  { regionName: 'Iron Mountains', startId: 'ash-hallow' },
  { regionName: 'Crimson Bayou', startId: 'mirehaven' },
  { regionName: 'Endless Prairie', startId: 'highwind-crossing' },
  { regionName: 'Whispering Pines', startId: 'cedarwatch' },
  { regionName: 'Shattered Desert', startId: 'red-mesa' },
  { regionName: 'Frozen Frontier', startId: 'frosthaven' },
];

const REGION_STARTS = REGION_START_IDS.map((r) => ({
  regionName: r.regionName,
  index: LOCATIONS.findIndex((l) => l.id === r.startId),
})).sort((a, b) => a.index - b.index);

/** Which region a location belongs to - undefined only for an id LOCATIONS doesn't contain. */
export function regionNameFor(locationId: string): string | undefined {
  const index = LOCATIONS.findIndex((l) => l.id === locationId);
  if (index === -1) return undefined;
  let current: string | undefined;
  for (const start of REGION_STARTS) {
    if (start.index <= index) current = start.regionName;
    else break;
  }
  return current;
}

/** Story order for a region name (Iron Mountains first, Frozen Frontier last) - for sorting
 *  region sections the same way every other region-grouped list in this project already does. */
export function regionSortIndex(regionName: string): number {
  return REGION_STARTS.findIndex((r) => r.regionName === regionName);
}
