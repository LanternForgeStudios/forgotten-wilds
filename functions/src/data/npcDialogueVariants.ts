// Server-side mirror of which quests gate each NPC's dialogue variants in src/data/npcs.ts - only
// the gating quest ids, never the dialogue text itself (that stays purely client-display). This is
// the smallest amount of duplication that lets talkToNpc.ts independently compute the same
// "current dialogue variant" key the client shows, so it can track which one the player last saw
// without trusting a client-reported value. Order matters - same priority order as each NPC's
// `dialogueVariants` array (resolveNpcDialogue/currentNpcDialogueVariantKey both take the first
// completed match), most-advanced-quest first. Keep in sync by hand with src/data/npcs.ts.
export const NPC_DIALOGUE_VARIANT_QUEST_IDS: Record<string, string[]> = {
  'elias-rowan': [
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
  'chief-aiyana-whitefeather': ['climbing-thunderbird-mesa', 'across-open-skies'],
  'elder-koda-running-elk': ['the-stone-circles'],
  'scout-niska': ['following-the-herd'],
  'prairie-spirit': ['voices-on-the-wind'],
};
