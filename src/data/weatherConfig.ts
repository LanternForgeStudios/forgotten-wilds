import type { WeatherKind } from '@/types';

/** Region-appropriate random weather pool for every top-level (no parentLocationId) overworld/town
 *  location - see src/utils/weather.ts's resolveWeather, which picks one entry uniformly at
 *  random. Repetition is the weighting mechanism (no separate weights field): 'sun' appearing
 *  twice in a 3-entry list means a ~67% chance of clear weather there. Grouped by the same regions
 *  src/data/locations.ts's own `// --- Region ---` comments use. The 7 STORY_WEATHER_LOCKS
 *  locations still carry an entry here for consistency (every top-level location has one), but
 *  resolveWeather never actually rolls from it for them - locked while incomplete, 'sun' once
 *  done, never a random pick. */
export const REGION_WEATHER_PALETTE: Record<string, WeatherKind[]> = {
  // --- Ash Hallow / Iron Mountains (MSQ Volume I / Book One) ---
  'ash-hallow': ['sun', 'sun', 'fog'],
  'ironwood-trail': ['sun', 'sun', 'fog'],
  'raven-ridge': ['sun', 'sun', 'fog'],
  'whisper-falls': ['sun', 'fog', 'rain'],
  'black-briar-forest': ['sun', 'fog', 'fog'],

  // --- Crimson Bayou (MSQ Volume II) ---
  'mirehaven': ['sun', 'rain', 'fog'],
  'cypress-marsh': ['sun', 'fog', 'rain'],
  'murkwater-trails': ['sun', 'fog', 'fog'],
  'hidden-river-landing': ['sun', 'fog', 'rain'],

  // --- Endless Prairie (MSQ Volume III) ---
  'highwind-crossing': ['sun', 'sun', 'rain'],
  'golden-prairie': ['sun', 'sun', 'rain'],
  'spirit-herd-plains': ['sun', 'sun', 'fog'],
  'sacred-hills': ['sun', 'sun', 'fog'],
  'stone-circle-valley': ['sun', 'sun', 'fog'],
  'thunderbird-mesa-approach': ['sun', 'rain', 'rain'],

  // --- Whispering Pines (MSQ Volume IV) ---
  'cedarwatch': ['sun', 'fog', 'rain'],
  'mistwood-path': ['sun', 'fog', 'fog'],
  'elder-forest': ['sun', 'fog', 'rain'],
  'silver-river': ['sun', 'fog', 'rain'],
  'ancient-cedar-shrine': ['sun', 'fog', 'rain'],
  'heartwood-approach': ['sun', 'fog', 'rain'],

  // --- Shattered Desert (MSQ Volume V) ---
  'red-mesa': ['sun', 'sun', 'sandstorm'],
  'sunfire-dunes': ['sun', 'sun', 'sandstorm'],
  'crimson-canyons': ['sun', 'sandstorm', 'sandstorm'],
  'painted-mesas': ['sun', 'sun', 'sandstorm'],
  'celestial-oasis': ['sun', 'sun', 'sandstorm'],
  'forgotten-observatory-approach': ['sun', 'sun', 'sandstorm'],

  // --- Frozen Frontier (MSQ Volume VI) ---
  'frosthaven': ['sun', 'snow', 'snow'],
  'snowveil-forest': ['sun', 'snow', 'snow'],
  'frozen-river': ['sun', 'snow', 'snow'],
  'glacier-pass': ['sun', 'snow', 'snow'],
  'aurora-basin': ['sun', 'snow', 'snow'],
  'hall-of-eternal-winter-approach': ['snow', 'snow', 'sun'],
};

/** Locations whose weather is locked to a specific state until a main-story quest completes,
 *  overriding REGION_WEATHER_PALETTE entirely while that quest is incomplete. Every quest id here
 *  is reused verbatim from src/utils/shrineRestoration.ts's SHRINE_RESTORED_QUEST - each of these
 *  is an existing "place stays wrong until its shrine is restored" MSQ beat, not new lore. Once
 *  the quest completes, the location reverts to its normal REGION_WEATHER_PALETTE roll. */
export const STORY_WEATHER_LOCKS: Record<string, { weather: WeatherKind; questId: string }> = {
  // Foggy until Spirit Grove's shrine is restored - the shrine sits within this same map.
  'ironwood-trail': { weather: 'fog', questId: 'rekindling-spirit-grove' },
  // Rainy until Ash Hallow's own town shrine is restored.
  'ash-hallow': { weather: 'rain', questId: 'the-first-flame' },
  // "A hushed water-logged marsh" - fog lifts once Mother Cypress Shrine's memory is restored.
  'cypress-marsh': { weather: 'fog', questId: 'seeds-of-memory' },
  // The carvings are "too worn to read at a glance" - fog lifts once their history is uncovered.
  'stone-circle-valley': { weather: 'fog', questId: 'the-stone-circles' },
  // The Ancient Cedar's shrine "long since withered" - rain until its Spirit Seed is restored.
  'ancient-cedar-shrine': { weather: 'rain', questId: 'seeds-of-the-ancient-cedar' },
  // "Restore the Winter Shrine and watch the aurora return" - locked snow until then.
  'aurora-basin': { weather: 'snow', questId: 'light-within-the-ice' },
  // The oasis's own encounter table already spawns sandstorm-devil enemies - a literal hazard,
  // not an inferred one, that clears once the Star Crystal is restored.
  'celestial-oasis': { weather: 'sandstorm', questId: 'fragments-of-the-sky' },
};
