// Server-side mirror of which quests gate each NPC's dialogue variants in src/data/npcs.ts - only
// the gating quest ids, never the dialogue text itself (that stays purely client-display). This is
// the smallest amount of duplication that lets talkToNpc.ts independently compute the same
// "current dialogue variant" key the client shows, so it can track which one the player last saw
// without trusting a client-reported value. Order matters - same priority order as each NPC's
// `dialogueVariants` array (resolveNpcDialogue/currentNpcDialogueVariantKey both take the first
// completed match), most-advanced-quest first. Keep in sync by hand with src/data/npcs.ts.
export const NPC_DIALOGUE_VARIANT_QUEST_IDS: Record<string, string[]> = {
  'elias-rowan': [
    'a-new-dawn',
    'embers-beneath-stone',
    'frostbound-pages',
    'the-mountain-remembers',
    'the-coalbound-warden',
    'beyond-the-lantern-light',
    'ash-hallow-tour',
    'a-new-keeper',
  ],
  'silas-flint': ['the-shrine-below', 'into-hollow-rail', 'beneath-hollow-rail'],
  'nell-ashby': ['embers-that-never-faded', 'the-lost-expedition'],
  'historian-miriam': [
    'embers-beneath-stone',
    'frostbound-pages',
    'the-mountain-remembers',
    'fragments-of-the-first-promise',
    'the-first-flame',
    'ash-hallow-tour',
  ],
  'hunter-garrick': ['shadows-on-raven-ridge', 'strange-tracks'],
  'spirit-child': ['rekindling-spirit-grove', 'the-forgotten-shrine'],
  // Crimson Bayou (MSQ Volume II)
  'mayor-celeste-broussard': ['the-bogwater-almanac', 'the-drowned-ledger', 'the-waters-remember', 'seeds-of-memory'],
  'lucien-boudreaux': [
    'the-bogwater-almanac',
    'the-drowned-ledger',
    'the-waters-remember',
    'reflections-of-the-past',
  ],
  'marsh-spirit': ['the-waters-remember', 'seeds-of-memory'],
  'sabine-thorne': ['the-waters-remember', 'guardian-of-the-deep', 'beneath-still-waters'],
  'innkeep-odette': ['the-waters-remember', 'lantern-beneath-still-waters'],
  'merchant-remy': ['the-waters-remember', 'beneath-still-waters'],
  'herbalist-noelle': ['the-waters-remember', 'seeds-of-memory'],
  'blacksmith-toussaint': ['seeds-of-memory'],
  // Endless Prairie (MSQ Volume III, Chapter 5)
  'chief-aiyana-whitefeather': [
    'the-first-promise-remembered',
    'the-great-thunderbird',
    'keeper-of-the-open-sky',
    'temple-above-the-clouds',
    'the-second-winter-count',
    'the-first-winter-count',
    'climbing-thunderbird-mesa',
    'across-open-skies',
  ],
  'elder-koda-running-elk': [
    'the-first-promise-remembered',
    'the-second-winter-count',
    'the-first-winter-count',
    'the-stone-circles',
  ],
  'scout-niska': ['following-the-herd'],
  'prairie-spirit': ['voices-on-the-wind'],
  // Whispering Pines (MSQ Volume IV, Chapter 7)
  'elder-rowan-birch': ['the-missing-pages', 'the-cedar-giant', 'heartwood-sanctuary', 'into-the-ancient-forest'],
  'archivist-elowen': [
    'beneath-the-roots',
    'the-second-recording',
    'the-first-recording',
    'heartwood-sanctuary',
    'the-lost-library',
    'seeds-of-the-ancient-cedar',
    'the-forest-has-fallen-silent',
    'into-the-ancient-forest',
  ],
  'forest-warden-rowan-hart': ['the-forest-has-fallen-silent'],
  'cedar-spirit': ['the-second-recording', 'the-first-recording', 'seeds-of-the-ancient-cedar'],
  // Shattered Desert (MSQ Volume V, Chapter 9)
  'elder-santiago-ortega': ['the-stars-never-lied', 'the-canyon-giant', 'the-desert-calls'],
  'scholar-nia-solis': [
    'lantern-of-forgotten-stars',
    'the-celestial-machine',
    'the-second-relic',
    'the-first-relic',
    'the-path-of-the-astronomers',
    'echoes-in-the-sand',
  ],
  'desert-ranger-tomas-vega': ['the-second-relic', 'the-first-relic'],
  'sand-spirit': ['fragments-of-the-sky'],
  // Frozen Frontier (MSQ Volume VI, Chapter 11)
  'elder-henrik': ['northbound'],
  'captain-astrid-frost': ['the-second-scout', 'the-first-scout', 'frozen-echoes'],
  'aurora-keeper-lyra': ['the-complete-memory', 'the-winter-stag', 'lantern-of-winters-resolve', 'the-second-scout', 'the-first-scout', 'hall-of-eternal-winter'],
  'winter-spirit': ['light-within-the-ice'],
};

/** Server-side mirror of each NPC's "report back" dialogue variants in src/data/npcs.ts (the
 *  ones with `reportForObjectiveId` set) - same gating-ids-only split as
 *  NPC_DIALOGUE_VARIANT_QUEST_IDS above. Checked first, and takes priority over that quest-id
 *  list, in currentNpcDialogueVariantKey - see isObjectiveReadyToReport. Keep in sync by hand with
 *  src/data/npcs.ts. */
export const NPC_DIALOGUE_REPORT_VARIANTS: Record<string, Array<{ questId: string; objectiveId: string }>> = {
  'elias-rowan': [
    { questId: 'frostbound-pages', objectiveId: 'talk-elias-frostbound' },
    { questId: 'embers-beneath-stone', objectiveId: 'talk-elias-embers' },
  ],
  'historian-miriam': [
    { questId: 'frostbound-pages', objectiveId: 'talk-miriam-frostbound' },
    { questId: 'embers-beneath-stone', objectiveId: 'talk-miriam-embers' },
  ],
  'lucien-boudreaux': [
    { questId: 'the-silent-grove', objectiveId: 'talk-lucien-2' },
    { questId: 'reflections-of-the-past', objectiveId: 'talk-lucien-temple' },
    { questId: 'the-drowned-ledger', objectiveId: 'talk-lucien-ledger' },
    { questId: 'the-bogwater-almanac', objectiveId: 'talk-lucien-almanac' },
  ],
  'mayor-celeste-broussard': [
    { questId: 'the-drowned-ledger', objectiveId: 'talk-celeste-ledger' },
    { questId: 'the-bogwater-almanac', objectiveId: 'talk-celeste-almanac' },
  ],
  'prairie-spirit': [
    { questId: 'voices-on-the-wind', objectiveId: 'talk-prairie-spirit-restore' },
    { questId: 'the-skys-second-gift', objectiveId: 'talk-prairie-spirit-charm2' },
    { questId: 'the-herds-enduring-bond', objectiveId: 'talk-prairie-spirit-totem2' },
  ],
  'elder-koda-running-elk': [
    { questId: 'the-stone-circles', objectiveId: 'talk-koda-report' },
    { questId: 'the-first-winter-count', objectiveId: 'talk-koda-winter-count-i' },
    { questId: 'the-second-winter-count', objectiveId: 'talk-koda-winter-count-ii' },
  ],
  'chief-aiyana-whitefeather': [
    { questId: 'the-first-winter-count', objectiveId: 'talk-aiyana-winter-count-i' },
    { questId: 'the-second-winter-count', objectiveId: 'talk-aiyana-winter-count-ii' },
  ],
  'cedar-spirit': [
    { questId: 'the-forest-has-fallen-silent', objectiveId: 'talk-cedar-spirit-meet' },
    { questId: 'the-first-recording', objectiveId: 'talk-cedar-spirit-recording-i' },
    { questId: 'the-second-recording', objectiveId: 'talk-cedar-spirit-recording-ii' },
    { questId: 'the-cedars-second-ring', objectiveId: 'talk-cedar-spirit-charm3' },
    { questId: 'roots-that-remember', objectiveId: 'talk-cedar-spirit-totem3' },
  ],
  'archivist-elowen': [
    { questId: 'the-lost-library', objectiveId: 'talk-elowen-report' },
    { questId: 'the-first-recording', objectiveId: 'talk-elowen-recording-i' },
    { questId: 'the-second-recording', objectiveId: 'talk-elowen-recording-ii' },
    { questId: 'the-keeper-beneath-the-cedar', objectiveId: 'talk-elowen-lantern' },
  ],
  'desert-ranger-tomas-vega': [
    { questId: 'the-first-relic', objectiveId: 'talk-tomas-relic-i' },
    { questId: 'the-second-relic', objectiveId: 'talk-tomas-relic-ii' },
  ],
  'scholar-nia-solis': [
    { questId: 'the-first-relic', objectiveId: 'talk-nia-relic-i' },
    { questId: 'the-second-relic', objectiveId: 'talk-nia-relic-ii' },
    { questId: 'lantern-of-forgotten-stars', objectiveId: 'talk-nia-lantern' },
  ],
  'sand-spirit': [
    { questId: 'the-stars-second-light', objectiveId: 'talk-sand-spirit-charm4' },
    { questId: 'sands-that-endure', objectiveId: 'talk-sand-spirit-totem4' },
  ],
  'captain-astrid-frost': [
    { questId: 'the-first-scout', objectiveId: 'talk-astrid-scout-i' },
    { questId: 'the-second-scout', objectiveId: 'talk-astrid-scout-ii' },
  ],
  'aurora-keeper-lyra': [
    { questId: 'the-first-scout', objectiveId: 'talk-lyra-scout-i' },
    { questId: 'the-second-scout', objectiveId: 'talk-lyra-scout-ii' },
    { questId: 'lantern-of-winters-resolve', objectiveId: 'talk-lyra-lantern' },
  ],
};
