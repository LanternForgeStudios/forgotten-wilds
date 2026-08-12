// Server-side mirror of each NPC's dialogue-variant gating in src/data/npcs.ts - only the gating
// quest/objective ids, never the dialogue text itself (that stays purely client-display). This is
// the smallest amount of duplication that lets talkToNpc.ts independently compute the same
// "current dialogue variant" key the client shows, so it can track which one the player last saw
// without trusting a client-reported value. Shape mirrors the client's own NpcDialogueVariant[]
// exactly (questId + optional reportForObjectiveId, minus `lines`) - one table instead of two, so
// there's only one place to keep in sync by hand with src/data/npcs.ts instead of two independently-
// ordered ones. Order matters within each NPC's list: currentNpcDialogueVariantKey
// (functions/src/engine/questEngine.ts) checks every reportForObjectiveId-tagged entry first
// (regardless of position), then every plain entry in array order, most-advanced-quest first.
export interface NpcDialogueVariantGate {
  /** One of this NPC's own gameplayHook.questIds. */
  questId: string;
  /** When set, this entry is a "report back" gate - see NpcDialogueVariant.reportForObjectiveId
   *  (src/types/npc.ts) for the full semantics; identical here. */
  reportForObjectiveId?: string;
}

export const NPC_DIALOGUE_VARIANTS: Record<string, NpcDialogueVariantGate[]> = {
  'elias-rowan': [
    { questId: 'a-new-dawn' },
    { questId: 'embers-beneath-stone' },
    { questId: 'frostbound-pages' },
    { questId: 'the-mountain-remembers' },
    { questId: 'the-coalbound-warden' },
    { questId: 'beyond-the-lantern-light' },
    { questId: 'ash-hallow-tour' },
    { questId: 'a-new-keeper' },
    { questId: 'frostbound-pages', reportForObjectiveId: 'talk-elias-frostbound' },
    { questId: 'embers-beneath-stone', reportForObjectiveId: 'talk-elias-embers' },
  ],
  'silas-flint': [
    { questId: 'the-shrine-below' },
    { questId: 'into-hollow-rail' },
    { questId: 'beneath-hollow-rail' },
  ],
  'nell-ashby': [
    { questId: 'embers-that-never-faded' },
    { questId: 'the-lost-expedition' },
  ],
  'historian-miriam': [
    { questId: 'embers-beneath-stone' },
    { questId: 'frostbound-pages' },
    { questId: 'the-mountain-remembers' },
    { questId: 'fragments-of-the-first-promise' },
    { questId: 'the-first-flame' },
    { questId: 'ash-hallow-tour' },
    { questId: 'frostbound-pages', reportForObjectiveId: 'talk-miriam-frostbound' },
    { questId: 'embers-beneath-stone', reportForObjectiveId: 'talk-miriam-embers' },
  ],
  'hunter-garrick': [
    { questId: 'shadows-on-raven-ridge' },
    { questId: 'strange-tracks' },
  ],
  'spirit-child': [
    { questId: 'rekindling-spirit-grove' },
    { questId: 'the-forgotten-shrine' },
  ],
  // Crimson Bayou (MSQ Volume II)
  'mayor-celeste-broussard': [
    { questId: 'the-bogwater-almanac' },
    { questId: 'the-drowned-ledger' },
    { questId: 'the-waters-remember' },
    { questId: 'seeds-of-memory' },
    { questId: 'the-drowned-ledger', reportForObjectiveId: 'talk-celeste-ledger' },
    { questId: 'the-bogwater-almanac', reportForObjectiveId: 'talk-celeste-almanac' },
  ],
  'lucien-boudreaux': [
    { questId: 'the-bogwater-almanac' },
    { questId: 'the-drowned-ledger' },
    { questId: 'the-waters-remember' },
    { questId: 'reflections-of-the-past' },
    { questId: 'the-silent-grove', reportForObjectiveId: 'talk-lucien-2' },
    { questId: 'reflections-of-the-past', reportForObjectiveId: 'talk-lucien-temple' },
    { questId: 'the-drowned-ledger', reportForObjectiveId: 'talk-lucien-ledger' },
    { questId: 'the-bogwater-almanac', reportForObjectiveId: 'talk-lucien-almanac' },
  ],
  'marsh-spirit': [
    { questId: 'the-waters-remember' },
    { questId: 'seeds-of-memory' },
  ],
  'sabine-thorne': [
    { questId: 'the-waters-remember' },
    { questId: 'guardian-of-the-deep' },
    { questId: 'beneath-still-waters' },
  ],
  'innkeep-odette': [
    { questId: 'the-waters-remember' },
    { questId: 'lantern-beneath-still-waters' },
  ],
  'merchant-remy': [
    { questId: 'the-waters-remember' },
    { questId: 'beneath-still-waters' },
  ],
  'herbalist-noelle': [
    { questId: 'the-waters-remember' },
    { questId: 'seeds-of-memory' },
  ],
  'blacksmith-toussaint': [
    { questId: 'seeds-of-memory' },
  ],
  // Endless Prairie (MSQ Volume III, Chapter 5)
  'chief-aiyana-whitefeather': [
    { questId: 'the-first-promise-remembered' },
    { questId: 'the-great-thunderbird' },
    { questId: 'keeper-of-the-open-sky' },
    { questId: 'temple-above-the-clouds' },
    { questId: 'the-second-winter-count' },
    { questId: 'the-first-winter-count' },
    { questId: 'climbing-thunderbird-mesa' },
    { questId: 'across-open-skies' },
    { questId: 'the-first-winter-count', reportForObjectiveId: 'talk-aiyana-winter-count-i' },
    { questId: 'the-second-winter-count', reportForObjectiveId: 'talk-aiyana-winter-count-ii' },
  ],
  'elder-koda-running-elk': [
    { questId: 'the-first-promise-remembered' },
    { questId: 'the-second-winter-count' },
    { questId: 'the-first-winter-count' },
    { questId: 'the-stone-circles' },
    { questId: 'the-stone-circles', reportForObjectiveId: 'talk-koda-report' },
    { questId: 'the-first-winter-count', reportForObjectiveId: 'talk-koda-winter-count-i' },
    { questId: 'the-second-winter-count', reportForObjectiveId: 'talk-koda-winter-count-ii' },
  ],
  'scout-niska': [
    { questId: 'following-the-herd' },
  ],
  'prairie-spirit': [
    { questId: 'voices-on-the-wind' },
    { questId: 'voices-on-the-wind', reportForObjectiveId: 'talk-prairie-spirit-restore' },
    { questId: 'the-skys-second-gift', reportForObjectiveId: 'talk-prairie-spirit-charm2' },
    { questId: 'the-herds-enduring-bond', reportForObjectiveId: 'talk-prairie-spirit-totem2' },
  ],
  // Whispering Pines (MSQ Volume IV, Chapter 7)
  'elder-rowan-birch': [
    { questId: 'the-missing-pages' },
    { questId: 'the-cedar-giant' },
    { questId: 'heartwood-sanctuary' },
    { questId: 'into-the-ancient-forest' },
  ],
  'archivist-elowen': [
    { questId: 'beneath-the-roots' },
    { questId: 'the-second-recording' },
    { questId: 'the-first-recording' },
    { questId: 'heartwood-sanctuary' },
    { questId: 'the-lost-library' },
    { questId: 'seeds-of-the-ancient-cedar' },
    { questId: 'the-forest-has-fallen-silent' },
    { questId: 'into-the-ancient-forest' },
    { questId: 'the-lost-library', reportForObjectiveId: 'talk-elowen-report' },
    { questId: 'the-first-recording', reportForObjectiveId: 'talk-elowen-recording-i' },
    { questId: 'the-second-recording', reportForObjectiveId: 'talk-elowen-recording-ii' },
    { questId: 'the-keeper-beneath-the-cedar', reportForObjectiveId: 'talk-elowen-lantern' },
  ],
  'forest-warden-rowan-hart': [
    { questId: 'the-forest-has-fallen-silent' },
  ],
  'cedar-spirit': [
    { questId: 'the-second-recording' },
    { questId: 'the-first-recording' },
    { questId: 'seeds-of-the-ancient-cedar' },
    { questId: 'the-forest-has-fallen-silent', reportForObjectiveId: 'talk-cedar-spirit-meet' },
    { questId: 'the-first-recording', reportForObjectiveId: 'talk-cedar-spirit-recording-i' },
    { questId: 'the-second-recording', reportForObjectiveId: 'talk-cedar-spirit-recording-ii' },
    { questId: 'the-cedars-second-ring', reportForObjectiveId: 'talk-cedar-spirit-charm3' },
    { questId: 'roots-that-remember', reportForObjectiveId: 'talk-cedar-spirit-totem3' },
  ],
  // Shattered Desert (MSQ Volume V, Chapter 9)
  'elder-santiago-ortega': [
    { questId: 'the-stars-never-lied' },
    { questId: 'the-canyon-giant' },
    { questId: 'the-desert-calls' },
  ],
  'scholar-nia-solis': [
    { questId: 'lantern-of-forgotten-stars' },
    { questId: 'the-celestial-machine' },
    { questId: 'the-second-relic' },
    { questId: 'the-first-relic' },
    { questId: 'the-path-of-the-astronomers' },
    { questId: 'echoes-in-the-sand' },
    { questId: 'the-first-relic', reportForObjectiveId: 'talk-nia-relic-i' },
    { questId: 'the-second-relic', reportForObjectiveId: 'talk-nia-relic-ii' },
    { questId: 'lantern-of-forgotten-stars', reportForObjectiveId: 'talk-nia-lantern' },
  ],
  'desert-ranger-tomas-vega': [
    { questId: 'the-second-relic' },
    { questId: 'the-first-relic' },
    { questId: 'the-first-relic', reportForObjectiveId: 'talk-tomas-relic-i' },
    { questId: 'the-second-relic', reportForObjectiveId: 'talk-tomas-relic-ii' },
  ],
  'sand-spirit': [
    { questId: 'fragments-of-the-sky' },
    { questId: 'the-stars-second-light', reportForObjectiveId: 'talk-sand-spirit-charm4' },
    { questId: 'sands-that-endure', reportForObjectiveId: 'talk-sand-spirit-totem4' },
  ],
  // Frozen Frontier (MSQ Volume VI, Chapter 11)
  'elder-henrik': [
    { questId: 'northbound' },
  ],
  'captain-astrid-frost': [
    { questId: 'the-second-scout' },
    { questId: 'the-first-scout' },
    { questId: 'frozen-echoes' },
    { questId: 'the-first-scout', reportForObjectiveId: 'talk-astrid-scout-i' },
    { questId: 'the-second-scout', reportForObjectiveId: 'talk-astrid-scout-ii' },
  ],
  'aurora-keeper-lyra': [
    { questId: 'the-complete-memory' },
    { questId: 'the-winter-stag' },
    { questId: 'lantern-of-winters-resolve' },
    { questId: 'the-second-scout' },
    { questId: 'the-first-scout' },
    { questId: 'hall-of-eternal-winter' },
    { questId: 'the-first-scout', reportForObjectiveId: 'talk-lyra-scout-i' },
    { questId: 'the-second-scout', reportForObjectiveId: 'talk-lyra-scout-ii' },
    { questId: 'lantern-of-winters-resolve', reportForObjectiveId: 'talk-lyra-lantern' },
  ],
  'winter-spirit': [
    { questId: 'light-within-the-ice' },
  ],
};
