// Authoritative — the client's src/data/quests.ts is a display copy only.

export type QuestObjectiveType =
  | 'talkToNpc'
  | 'defeatEnemies'
  | 'reachLocation'
  | 'collectItem'
  | 'defeatBoss'
  // Interacting with a shrine/landmark interactable (see interactWithShrine.ts) - not tied to a
  // consumable item or an npc conversation, so it gets its own objective type.
  | 'interactWithShrine';

export interface QuestObjectiveDef {
  id: string;
  type: QuestObjectiveType;
  targetId: string;
  requiredCount: number;
}

export interface QuestDef {
  id: string;
  prerequisiteQuestId: string | null;
  objectives: QuestObjectiveDef[];
  reward: {
    xp: number;
    gold: number;
    itemIds?: string[];
    spiritEssence?: number;
    /** A Specialty Attack id (data/skills.ts) to add to Player.knownSkillIds on completion - used
     *  by the two Forgotten Treatises side quests (frostbound-pages grants frost-lance,
     *  embers-beneath-stone grants ember-burst; see CombatScene.tsx's "Select Spirit Ability"
     *  submenu). */
    grantSkillId?: string;
    /** Unlocks Stamina/Dash on completion (see interactWithShrine.ts) - a generic reward flag
     *  rather than a hardcoded quest id check, the same way grantSkillId is generic rather than a
     *  hardcoded skill-quest special case. Only 'rekindling-spirit-grove' sets this today. */
    grantsStaminaUnlock?: boolean;
    /** A lore entry id (src/data/lore.ts - client-display-only, no server-side copy of the text)
     *  to add to JournalState.loreUnlocked on completion. */
    grantLoreId?: string;
    /** Equips each of reward.itemIds that's an EQUIPMENT-table entry into its slot, but ONLY if
     *  that slot is currently empty - never overwrites gear the player already has on. Granting
     *  the item to inventory happens either way (grantItem, same as any reward); this just also
     *  fills the slot so a starter-kit item (e.g. a-new-keeper's travelers-cloak) actually shows up
     *  on the character immediately instead of sitting unequipped until the player thinks to open
     *  the Equipment screen themselves. Only 'a-new-keeper' sets this today. */
    autoEquip?: boolean;
    /** Adds to Player.regionalReputation on completion - same additive shape as spiritEssence.
     *  This is currently ONE running total across the whole game, not tracked per-region, despite
     *  docs/Mytherra-MSQ_breakdown.md describing region-specific reputation rewards (e.g. "Iron
     *  Mountains Regional Reputation," "Bayou Regional Reputation") - seeded here as a global
     *  counter since that's what the existing player.regionalReputation field actually is; a real
     *  per-region model is a bigger data-model change, not something to build as a side effect of
     *  one quest reward. First real usage: 'the-waters-remember' (MSF-CB-010). */
    regionalReputation?: number;
  };
}

// The real Main Story Framework content (docs/Mytherra-MSQ_breakdown.md): Prologue (MSF-P-001-004)
// plus Iron Mountains Chapter 1 "Echoes in the Woods" (MSF-IM-001-006) and Chapter 2 "Echoes of
// Stone" (MSF-IM-007-012). Replaces the ad hoc chain built before the MSQ document existed.
export const QUESTS: Record<string, QuestDef> = {
  // --- Prologue ---
  'a-new-keeper': {
    id: 'a-new-keeper',
    prerequisiteQuestId: null,
    objectives: [{ id: 'talk-elias', type: 'talkToNpc', targetId: 'elias-rowan', requiredCount: 1 }],
    reward: { xp: 10, gold: 20, itemIds: ['travelers-cloak', 'traveler-pants'], autoEquip: true },
  },
  'ash-hallow-tour': {
    id: 'ash-hallow-tour',
    prerequisiteQuestId: 'a-new-keeper',
    objectives: [
      { id: 'talk-mara', type: 'talkToNpc', targetId: 'mara-ash', requiredCount: 1 },
      { id: 'talk-aldren', type: 'talkToNpc', targetId: 'aldren-stone', requiredCount: 1 },
      { id: 'talk-tessa', type: 'talkToNpc', targetId: 'tessa-ironhand', requiredCount: 1 },
      { id: 'talk-willow', type: 'talkToNpc', targetId: 'willow-briar', requiredCount: 1 },
      { id: 'talk-juniper', type: 'talkToNpc', targetId: 'juniper-reed', requiredCount: 1 },
      { id: 'talk-silas', type: 'talkToNpc', targetId: 'silas-flint', requiredCount: 1 },
      { id: 'talk-miriam', type: 'talkToNpc', targetId: 'historian-miriam', requiredCount: 1 },
      { id: 'talk-mayor', type: 'talkToNpc', targetId: 'mayor-eleanor-ashcroft', requiredCount: 1 },
    ],
    reward: { xp: 10, gold: 30, itemIds: ['healing-poultice', 'healing-poultice', 'lantern-oil'] },
  },
  'the-first-flame': {
    id: 'the-first-flame',
    prerequisiteQuestId: 'ash-hallow-tour',
    objectives: [
      { id: 'talk-miriam-shrine', type: 'talkToNpc', targetId: 'historian-miriam', requiredCount: 1 },
      { id: 'light-shrine', type: 'interactWithShrine', targetId: 'ash-hallow-shrine', requiredCount: 1 },
    ],
    reward: { xp: 10, gold: 20, spiritEssence: 15 },
  },
  'beyond-the-lantern-light': {
    id: 'beyond-the-lantern-light',
    prerequisiteQuestId: 'the-first-flame',
    objectives: [
      { id: 'reach-ironwood', type: 'reachLocation', targetId: 'ironwood-trail', requiredCount: 1 },
      { id: 'reach-camp', type: 'reachLocation', targetId: 'hunters-camp', requiredCount: 1 },
      { id: 'talk-garrick', type: 'talkToNpc', targetId: 'hunter-garrick', requiredCount: 1 },
    ],
    reward: { xp: 20, gold: 0 },
  },

  // --- Iron Mountains, Chapter 1: Echoes in the Woods ---
  'strange-tracks': {
    id: 'strange-tracks',
    prerequisiteQuestId: 'beyond-the-lantern-light',
    objectives: [
      { id: 'talk-garrick-2', type: 'talkToNpc', targetId: 'hunter-garrick', requiredCount: 1 },
      { id: 'defeat-echo', type: 'defeatEnemies', targetId: 'mothling', requiredCount: 1 },
      { id: 'discover-grove', type: 'reachLocation', targetId: 'spirit-grove', requiredCount: 1 },
    ],
    reward: { xp: 15, gold: 15, spiritEssence: 10 },
  },
  'the-forgotten-shrine': {
    id: 'the-forgotten-shrine',
    prerequisiteQuestId: 'strange-tracks',
    objectives: [
      { id: 'talk-spirit-child', type: 'talkToNpc', targetId: 'spirit-child', requiredCount: 1 },
      { id: 'investigate-shrine', type: 'interactWithShrine', targetId: 'spirit-grove', requiredCount: 1 },
    ],
    reward: { xp: 15, gold: 10 },
  },
  'fragments-of-the-first-promise': {
    id: 'fragments-of-the-first-promise',
    prerequisiteQuestId: 'the-forgotten-shrine',
    objectives: [
      { id: 'get-stone', type: 'collectItem', targetId: 'stone-fragment', requiredCount: 1 },
      { id: 'get-water', type: 'collectItem', targetId: 'water-fragment', requiredCount: 1 },
      { id: 'get-wind', type: 'collectItem', targetId: 'wind-fragment', requiredCount: 1 },
    ],
    reward: { xp: 50, gold: 25, spiritEssence: 15 },
  },
  'rekindling-spirit-grove': {
    id: 'rekindling-spirit-grove',
    prerequisiteQuestId: 'fragments-of-the-first-promise',
    objectives: [{ id: 'restore-shrine', type: 'interactWithShrine', targetId: 'spirit-grove', requiredCount: 1 }],
    // Completing this quest is also what unlocks Stamina/Dash - see interactWithShrine.ts, which
    // grants the base Stamina pool the moment any quest with grantsStaminaUnlock completes.
    reward: { xp: 50, gold: 30, spiritEssence: 20, grantsStaminaUnlock: true },
  },
  'shadows-on-raven-ridge': {
    id: 'shadows-on-raven-ridge',
    prerequisiteQuestId: 'rekindling-spirit-grove',
    objectives: [
      { id: 'talk-garrick-3', type: 'talkToNpc', targetId: 'hunter-garrick', requiredCount: 1 },
      { id: 'reach-ridge', type: 'reachLocation', targetId: 'raven-ridge', requiredCount: 1 },
      { id: 'talk-caleb', type: 'talkToNpc', targetId: 'ranger-caleb', requiredCount: 1 },
    ],
    reward: { xp: 25, gold: 20 },
  },
  'beneath-hollow-rail': {
    id: 'beneath-hollow-rail',
    prerequisiteQuestId: 'shadows-on-raven-ridge',
    objectives: [
      { id: 'talk-silas-2', type: 'talkToNpc', targetId: 'silas-flint', requiredCount: 1 },
      { id: 'reach-mine', type: 'reachLocation', targetId: 'hollow-rail-mine', requiredCount: 1 },
    ],
    reward: { xp: 25, gold: 30, itemIds: ['healing-poultice', 'healing-poultice'] },
  },

  // --- Iron Mountains, Chapter 2: Echoes of Stone ---
  'into-hollow-rail': {
    id: 'into-hollow-rail',
    prerequisiteQuestId: 'beneath-hollow-rail',
    objectives: [{ id: 'clear-shafts', type: 'defeatEnemies', targetId: 'restless-miner', requiredCount: 3 }],
    reward: { xp: 30, gold: 20 },
  },
  'the-lost-expedition': {
    id: 'the-lost-expedition',
    prerequisiteQuestId: 'into-hollow-rail',
    objectives: [
      { id: 'talk-nell', type: 'talkToNpc', targetId: 'nell-ashby', requiredCount: 1 },
      { id: 'calm-echoes', type: 'defeatEnemies', targetId: 'coal-spirit', requiredCount: 2 },
    ],
    reward: { xp: 30, gold: 20, spiritEssence: 10 },
  },
  'embers-that-never-faded': {
    id: 'embers-that-never-faded',
    prerequisiteQuestId: 'the-lost-expedition',
    objectives: [{ id: 'collect-lantern', type: 'collectItem', targetId: 'miners-lost-lantern', requiredCount: 1 }],
    reward: { xp: 40, gold: 25, itemIds: ['miners-lost-lantern-equipped'] },
  },
  'the-shrine-below': {
    id: 'the-shrine-below',
    prerequisiteQuestId: 'embers-that-never-faded',
    objectives: [
      { id: 'clear-wraiths', type: 'defeatEnemies', targetId: 'coal-wraith', requiredCount: 2 },
      { id: 'restore-mine-shrine', type: 'interactWithShrine', targetId: 'mine-shrine', requiredCount: 1 },
    ],
    reward: { xp: 30, gold: 20 },
  },
  'the-coalbound-warden': {
    id: 'the-coalbound-warden',
    prerequisiteQuestId: 'the-shrine-below',
    objectives: [{ id: 'defeat-warden', type: 'defeatBoss', targetId: 'coalbound-warden', requiredCount: 1 }],
    reward: { xp: 100, gold: 100, itemIds: ['wardens-ember-heart', 'mountain-guardian-totem'] },
  },
  'the-mountain-remembers': {
    id: 'the-mountain-remembers',
    prerequisiteQuestId: 'the-coalbound-warden',
    objectives: [
      { id: 'talk-elias-final', type: 'talkToNpc', targetId: 'elias-rowan', requiredCount: 1 },
      { id: 'talk-miriam-final', type: 'talkToNpc', targetId: 'historian-miriam', requiredCount: 1 },
    ],
    reward: { xp: 50, gold: 50, itemIds: ['guardian-memory-fragment-1'] },
  },

  // --- Iron Mountains Side Quests (docs/Mytherra-SQ_breakdown.md): The Forgotten Treatises ---
  'frostbound-pages': {
    id: 'frostbound-pages',
    prerequisiteQuestId: 'the-mountain-remembers',
    objectives: [
      { id: 'get-frostbound-treatise', type: 'collectItem', targetId: 'frostbound-treatise', requiredCount: 1 },
      { id: 'talk-elias-frostbound', type: 'talkToNpc', targetId: 'elias-rowan', requiredCount: 1 },
      { id: 'talk-miriam-frostbound', type: 'talkToNpc', targetId: 'historian-miriam', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'frost-lance', grantLoreId: 'forgotten-treatise-i' },
  },
  'embers-beneath-stone': {
    id: 'embers-beneath-stone',
    prerequisiteQuestId: 'frostbound-pages',
    objectives: [
      { id: 'get-ember-codex', type: 'collectItem', targetId: 'ember-codex', requiredCount: 1 },
      { id: 'talk-elias-embers', type: 'talkToNpc', targetId: 'elias-rowan', requiredCount: 1 },
      { id: 'talk-miriam-embers', type: 'talkToNpc', targetId: 'historian-miriam', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'ember-burst', grantLoreId: 'forgotten-treatise-ii' },
  },

  // --- Crimson Bayou (MSQ Volume II), Chapter 3: Whispers in the Water ---
  // Kebab-case id mapping (MSF id -> id here), per the Implementation Notes convention established
  // for Prologue/Ch1/Ch2 above: MSF-CB-001 a-long-road-south, MSF-CB-002 forgotten-names,
  // MSF-CB-003 the-silent-grove, MSF-CB-004 seeds-of-memory, MSF-CB-005 beneath-still-waters.
  'a-long-road-south': {
    id: 'a-long-road-south',
    prerequisiteQuestId: 'the-mountain-remembers',
    objectives: [
      { id: 'reach-mirehaven', type: 'reachLocation', targetId: 'mirehaven', requiredCount: 1 },
      { id: 'talk-celeste', type: 'talkToNpc', targetId: 'mayor-celeste-broussard', requiredCount: 1 },
      { id: 'talk-lucien', type: 'talkToNpc', targetId: 'lucien-boudreaux', requiredCount: 1 },
    ],
    reward: { xp: 30, gold: 20 },
  },
  'forgotten-names': {
    id: 'forgotten-names',
    prerequisiteQuestId: 'a-long-road-south',
    objectives: [
      { id: 'reach-cypress-marsh', type: 'reachLocation', targetId: 'cypress-marsh', requiredCount: 1 },
      { id: 'reach-murkwater-trails', type: 'reachLocation', targetId: 'murkwater-trails', requiredCount: 1 },
      { id: 'reach-hidden-river-landing', type: 'reachLocation', targetId: 'hidden-river-landing', requiredCount: 1 },
      { id: 'talk-marsh-spirit', type: 'talkToNpc', targetId: 'marsh-spirit', requiredCount: 1 },
    ],
    reward: { xp: 25, gold: 15, grantLoreId: 'lore-vanishing-memories' },
  },
  'the-silent-grove': {
    id: 'the-silent-grove',
    prerequisiteQuestId: 'forgotten-names',
    objectives: [
      { id: 'investigate-mother-cypress', type: 'interactWithShrine', targetId: 'mother-cypress-shrine', requiredCount: 1 },
      { id: 'talk-lucien-2', type: 'talkToNpc', targetId: 'lucien-boudreaux', requiredCount: 1 },
    ],
    reward: { xp: 20, gold: 10 },
  },
  'seeds-of-memory': {
    id: 'seeds-of-memory',
    prerequisiteQuestId: 'the-silent-grove',
    objectives: [
      { id: 'get-heart-seed-cypress', type: 'collectItem', targetId: 'heart-seed-cypress', requiredCount: 1 },
      { id: 'get-heart-seed-murkwater', type: 'collectItem', targetId: 'heart-seed-murkwater', requiredCount: 1 },
      { id: 'get-heart-seed-river', type: 'collectItem', targetId: 'heart-seed-river', requiredCount: 1 },
      { id: 'restore-mother-cypress', type: 'interactWithShrine', targetId: 'mother-cypress-shrine', requiredCount: 1 },
    ],
    reward: { xp: 60, gold: 30, spiritEssence: 15, grantLoreId: 'lore-mother-cypress' },
  },
  'beneath-still-waters': {
    id: 'beneath-still-waters',
    prerequisiteQuestId: 'seeds-of-memory',
    objectives: [
      { id: 'talk-sabine', type: 'talkToNpc', targetId: 'sabine-thorne', requiredCount: 1 },
      { id: 'clear-entrance', type: 'defeatEnemies', targetId: 'rougarou-stalker', requiredCount: 2 },
    ],
    reward: { xp: 40, gold: 25 },
  },

  // --- Crimson Bayou (MSQ Volume II), Chapter 4: The Deep Current ---
  // Kebab-case id mapping: MSF-CB-006 into-the-deep-current, MSF-CB-007 reflections-of-the-past,
  // MSF-CB-008 lantern-beneath-still-waters, MSF-CB-009 guardian-of-the-deep, MSF-CB-010
  // the-waters-remember.
  'into-the-deep-current': {
    id: 'into-the-deep-current',
    prerequisiteQuestId: 'beneath-still-waters',
    objectives: [
      { id: 'reach-temple', type: 'reachLocation', targetId: 'temple-of-the-deep-current', requiredCount: 1 },
      { id: 'clear-flooded-gallery', type: 'defeatEnemies', targetId: 'marsh-crocodile', requiredCount: 2 },
    ],
    reward: { xp: 40, gold: 20 },
  },
  'reflections-of-the-past': {
    id: 'reflections-of-the-past',
    prerequisiteQuestId: 'into-the-deep-current',
    objectives: [
      { id: 'get-temple-records', type: 'collectItem', targetId: 'temple-records', requiredCount: 1 },
      { id: 'talk-lucien-temple', type: 'talkToNpc', targetId: 'lucien-boudreaux', requiredCount: 1 },
    ],
    reward: { xp: 30, gold: 15, grantLoreId: 'lore-temple-records' },
  },
  'lantern-beneath-still-waters': {
    id: 'lantern-beneath-still-waters',
    prerequisiteQuestId: 'reflections-of-the-past',
    objectives: [{ id: 'get-lantern', type: 'collectItem', targetId: 'lantern-of-still-waters', requiredCount: 1 }],
    reward: { xp: 50, gold: 0, itemIds: ['lantern-of-still-waters-equipped'], grantLoreId: 'lore-keeper-elise-duvall' },
  },
  'guardian-of-the-deep': {
    id: 'guardian-of-the-deep',
    prerequisiteQuestId: 'lantern-beneath-still-waters',
    objectives: [{ id: 'defeat-guardian', type: 'defeatBoss', targetId: 'ancient-serpent-guardian', requiredCount: 1 }],
    reward: { xp: 200, gold: 110, itemIds: ['mother-cypress-totem'] },
  },
  'the-waters-remember': {
    id: 'the-waters-remember',
    prerequisiteQuestId: 'guardian-of-the-deep',
    objectives: [
      { id: 'talk-lucien-final', type: 'talkToNpc', targetId: 'lucien-boudreaux', requiredCount: 1 },
      { id: 'witness-mother-cypress', type: 'interactWithShrine', targetId: 'mother-cypress-shrine', requiredCount: 1 },
    ],
    // First real usage of regionalReputation (see Phase 0's reconciliation note on this field).
    reward: { xp: 60, gold: 30, itemIds: ['guardian-memory-fragment-2'], regionalReputation: 50 },
  },

  // --- Crimson Bayou Side Quests (docs/Mytherra-SQ_breakdown.md): The Drowned Ledgers ---
  // Mirrors Iron Mountains' Forgotten Treatises pattern exactly: collect a hidden key item, turn
  // it in to a giver NPC then a translator NPC, reward grants a quest-taught Skill + Lore entry.
  'the-drowned-ledger': {
    id: 'the-drowned-ledger',
    prerequisiteQuestId: 'the-waters-remember',
    objectives: [
      { id: 'get-drowned-ledger', type: 'collectItem', targetId: 'drowned-ledger', requiredCount: 1 },
      { id: 'talk-celeste-ledger', type: 'talkToNpc', targetId: 'mayor-celeste-broussard', requiredCount: 1 },
      { id: 'talk-lucien-ledger', type: 'talkToNpc', targetId: 'lucien-boudreaux', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'marsh-toxin', grantLoreId: 'drowned-ledger-i' },
  },
  'the-bogwater-almanac': {
    id: 'the-bogwater-almanac',
    prerequisiteQuestId: 'the-drowned-ledger',
    objectives: [
      { id: 'get-bogwater-almanac', type: 'collectItem', targetId: 'bogwater-almanac', requiredCount: 1 },
      { id: 'talk-celeste-almanac', type: 'talkToNpc', targetId: 'mayor-celeste-broussard', requiredCount: 1 },
      { id: 'talk-lucien-almanac', type: 'talkToNpc', targetId: 'lucien-boudreaux', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'hush-of-reeds', grantLoreId: 'drowned-ledger-ii' },
  },

  // --- Endless Prairie (MSQ Volume III), Chapter 5: Where the Sky Meets the Earth ---
  // Kebab-case id mapping: MSF-EP-001 across-open-skies, MSF-EP-002 following-the-herd, MSF-EP-003
  // voices-on-the-wind, MSF-EP-004 the-stone-circles, MSF-EP-005 climbing-thunderbird-mesa. Gated
  // behind the Bayou MSQ finale (the-waters-remember), not its side quests, matching how Bayou's
  // own a-long-road-south gated behind the-mountain-remembers rather than Iron Mountains' side
  // quests. Per docs/Mytherra-Location_breakdown.md's Implementation Notes: MSF-EP-005 as
  // documented continues into Thunderbird Mesa's interior (Summit Temple, Guardian Trials) - that
  // part is Chapter 6's scope. This quest ends at reaching Thunderbird Mesa Approach instead.
  'across-open-skies': {
    id: 'across-open-skies',
    prerequisiteQuestId: 'the-waters-remember',
    objectives: [
      { id: 'reach-highwind-crossing', type: 'reachLocation', targetId: 'highwind-crossing', requiredCount: 1 },
      { id: 'talk-chief-aiyana', type: 'talkToNpc', targetId: 'chief-aiyana-whitefeather', requiredCount: 1 },
      { id: 'talk-elder-koda', type: 'talkToNpc', targetId: 'elder-koda-running-elk', requiredCount: 1 },
    ],
    reward: { xp: 30, gold: 20 },
  },
  'following-the-herd': {
    id: 'following-the-herd',
    prerequisiteQuestId: 'across-open-skies',
    objectives: [
      { id: 'talk-niska-start', type: 'talkToNpc', targetId: 'scout-niska', requiredCount: 1 },
      { id: 'reach-spirit-herd-plains', type: 'reachLocation', targetId: 'spirit-herd-plains', requiredCount: 1 },
      { id: 'reach-sacred-hills', type: 'reachLocation', targetId: 'sacred-hills', requiredCount: 1 },
      { id: 'talk-prairie-spirit-meet', type: 'talkToNpc', targetId: 'prairie-spirit', requiredCount: 1 },
    ],
    reward: { xp: 25, gold: 15 },
  },
  'voices-on-the-wind': {
    id: 'voices-on-the-wind',
    prerequisiteQuestId: 'following-the-herd',
    objectives: [
      { id: 'get-wind-stone-golden-prairie', type: 'collectItem', targetId: 'wind-stone-golden-prairie', requiredCount: 1 },
      { id: 'get-wind-stone-spirit-herd-plains', type: 'collectItem', targetId: 'wind-stone-spirit-herd-plains', requiredCount: 1 },
      { id: 'get-wind-stone-stone-circle-valley', type: 'collectItem', targetId: 'wind-stone-stone-circle-valley', requiredCount: 1 },
      // Sacred Hills has no separate shrine landmark - Prairie Spirit herself is the shrine's
      // living voice, so restoration is a conversation, not an interactWithShrine objective.
      { id: 'talk-prairie-spirit-restore', type: 'talkToNpc', targetId: 'prairie-spirit', requiredCount: 1 },
    ],
    reward: { xp: 60, gold: 30, spiritEssence: 15 },
  },
  'the-stone-circles': {
    id: 'the-stone-circles',
    prerequisiteQuestId: 'voices-on-the-wind',
    objectives: [
      { id: 'reach-stone-circle-valley', type: 'reachLocation', targetId: 'stone-circle-valley', requiredCount: 1 },
      { id: 'investigate-carvings', type: 'interactWithShrine', targetId: 'stone-circle-carvings', requiredCount: 1 },
      { id: 'talk-koda-report', type: 'talkToNpc', targetId: 'elder-koda-running-elk', requiredCount: 1 },
    ],
    reward: { xp: 50, gold: 25, grantLoreId: 'lore-stone-circle-carvings' },
  },
  'climbing-thunderbird-mesa': {
    id: 'climbing-thunderbird-mesa',
    prerequisiteQuestId: 'the-stone-circles',
    objectives: [
      { id: 'talk-aiyana-final', type: 'talkToNpc', targetId: 'chief-aiyana-whitefeather', requiredCount: 1 },
      { id: 'reach-thunderbird-mesa-approach', type: 'reachLocation', targetId: 'thunderbird-mesa-approach', requiredCount: 1 },
    ],
    reward: { xp: 80, gold: 40, itemIds: ['guardian-memory-fragment-3'], regionalReputation: 50 },
  },

  // --- Endless Prairie Side Quest (docs/Mytherra-SQ_breakdown.md): The Winter Counts ---
  // Mirrors Iron Mountains' Forgotten Treatises / Crimson Bayou's Drowned Ledgers exactly: collect
  // a hidden key item, turn it in to a giver NPC then a translator NPC, reward grants a
  // quest-taught Skill + Lore entry.
  'the-first-winter-count': {
    id: 'the-first-winter-count',
    prerequisiteQuestId: 'climbing-thunderbird-mesa',
    objectives: [
      { id: 'get-winter-count-hide-i', type: 'collectItem', targetId: 'winter-count-hide-i', requiredCount: 1 },
      { id: 'talk-aiyana-winter-count-i', type: 'talkToNpc', targetId: 'chief-aiyana-whitefeather', requiredCount: 1 },
      { id: 'talk-koda-winter-count-i', type: 'talkToNpc', targetId: 'elder-koda-running-elk', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'winters-memory', grantLoreId: 'winter-count-i' },
  },
  'the-second-winter-count': {
    id: 'the-second-winter-count',
    prerequisiteQuestId: 'the-first-winter-count',
    objectives: [
      { id: 'get-winter-count-hide-ii', type: 'collectItem', targetId: 'winter-count-hide-ii', requiredCount: 1 },
      { id: 'talk-aiyana-winter-count-ii', type: 'talkToNpc', targetId: 'chief-aiyana-whitefeather', requiredCount: 1 },
      { id: 'talk-koda-winter-count-ii', type: 'talkToNpc', targetId: 'elder-koda-running-elk', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'prairie-wildfire', grantLoreId: 'winter-count-ii' },
  },

  // --- Endless Prairie (MSQ Volume III), Chapter 6: Wings of the First Promise ---
  // Kebab-case id mapping: MSF-EP-006 temple-above-the-clouds, MSF-EP-007
  // keeper-of-the-open-sky, MSF-EP-008 the-great-thunderbird, MSF-EP-009
  // the-first-promise-remembered. Gated behind Chapter 5's true finale
  // (climbing-thunderbird-mesa), not the Winter Counts side quest.
  'temple-above-the-clouds': {
    id: 'temple-above-the-clouds',
    prerequisiteQuestId: 'climbing-thunderbird-mesa',
    objectives: [
      { id: 'reach-summit-temple', type: 'reachLocation', targetId: 'summit-temple', requiredCount: 1 },
      { id: 'restore-wind-mechanism', type: 'interactWithShrine', targetId: 'ancient-wind-mechanism', requiredCount: 1 },
      { id: 'reach-sky-bridge', type: 'reachLocation', targetId: 'sky-bridge', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 20 },
  },
  'keeper-of-the-open-sky': {
    id: 'keeper-of-the-open-sky',
    prerequisiteQuestId: 'temple-above-the-clouds',
    objectives: [
      { id: 'reach-lantern-sanctuary', type: 'reachLocation', targetId: 'lantern-sanctuary', requiredCount: 1 },
      { id: 'get-lantern-of-open-skies', type: 'collectItem', targetId: 'lantern-of-open-skies', requiredCount: 1 },
    ],
    reward: { xp: 50, gold: 0, itemIds: ['lantern-of-open-skies-equipped'], grantLoreId: 'lore-keeper-talon-greywind' },
  },
  'the-great-thunderbird': {
    id: 'the-great-thunderbird',
    prerequisiteQuestId: 'keeper-of-the-open-sky',
    objectives: [
      { id: 'reach-guardian-peak', type: 'reachLocation', targetId: 'guardian-peak', requiredCount: 1 },
      { id: 'defeat-great-thunderbird', type: 'defeatBoss', targetId: 'great-thunderbird', requiredCount: 1 },
    ],
    reward: { xp: 260, gold: 140, itemIds: ['thunderbird-totem'] },
  },
  // Chapter 6 + Volume III finale. "Witness Guardian Memory III" reuses stone-circle-carvings a
  // second time (same shrine, sequential quest reuse) - mother-cypress-shrine's own 3x-reused
  // precedent in Bayou (investigate -> restore -> witness).
  'the-first-promise-remembered': {
    id: 'the-first-promise-remembered',
    prerequisiteQuestId: 'the-great-thunderbird',
    objectives: [
      { id: 'talk-aiyana-final', type: 'talkToNpc', targetId: 'chief-aiyana-whitefeather', requiredCount: 1 },
      { id: 'witness-stone-circles', type: 'interactWithShrine', targetId: 'stone-circle-carvings', requiredCount: 1 },
    ],
    reward: { xp: 80, gold: 40, itemIds: ['guardian-memory-fragment-4'], regionalReputation: 60, grantLoreId: 'lore-guardian-memory-iii' },
  },

  // --- Whispering Pines (MSQ Volume IV), Chapter 7: The Silent Forest ---
  // Kebab-case id mapping: MSF-WP-001 into-the-ancient-forest, MSF-WP-002
  // the-forest-has-fallen-silent, MSF-WP-003 seeds-of-the-ancient-cedar, MSF-WP-004
  // the-lost-library, MSF-WP-005 heartwood-sanctuary. Gated behind Volume III's own true finale,
  // matching the-waters-remember's own role gating Volume III in.  Whispering Pines spans two
  // chapters like Endless Prairie did (Chapter 8 - "Echoes of the First Keepers" - is the region's
  // actual dungeon/boss), so per the established Guardian Memory Fragment convention, MSF-WP-005
  // does NOT grant one here - that's reserved for Chapter 8's true finale (fragment-5), same
  // intended shape as fragment-3/4's split, this time built correctly the first time.
  'into-the-ancient-forest': {
    id: 'into-the-ancient-forest',
    prerequisiteQuestId: 'the-first-promise-remembered',
    objectives: [
      { id: 'reach-cedarwatch', type: 'reachLocation', targetId: 'cedarwatch', requiredCount: 1 },
      { id: 'talk-elder-rowan-birch', type: 'talkToNpc', targetId: 'elder-rowan-birch', requiredCount: 1 },
      { id: 'talk-archivist-elowen', type: 'talkToNpc', targetId: 'archivist-elowen', requiredCount: 1 },
    ],
    reward: { xp: 30, gold: 20 },
  },
  'the-forest-has-fallen-silent': {
    id: 'the-forest-has-fallen-silent',
    prerequisiteQuestId: 'into-the-ancient-forest',
    objectives: [
      { id: 'talk-warden-start', type: 'talkToNpc', targetId: 'forest-warden-rowan-hart', requiredCount: 1 },
      { id: 'reach-mistwood-path', type: 'reachLocation', targetId: 'mistwood-path', requiredCount: 1 },
      { id: 'reach-elder-forest', type: 'reachLocation', targetId: 'elder-forest', requiredCount: 1 },
      { id: 'calm-echoes', type: 'defeatEnemies', targetId: 'corrupted-echo', requiredCount: 2 },
      { id: 'reach-ancient-cedar-shrine', type: 'reachLocation', targetId: 'ancient-cedar-shrine', requiredCount: 1 },
      { id: 'talk-cedar-spirit-meet', type: 'talkToNpc', targetId: 'cedar-spirit', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 20, spiritEssence: 10 },
  },
  'seeds-of-the-ancient-cedar': {
    id: 'seeds-of-the-ancient-cedar',
    prerequisiteQuestId: 'the-forest-has-fallen-silent',
    objectives: [
      { id: 'get-spirit-seed-elder-forest', type: 'collectItem', targetId: 'spirit-seed-elder-forest', requiredCount: 1 },
      { id: 'get-spirit-seed-silver-river', type: 'collectItem', targetId: 'spirit-seed-silver-river', requiredCount: 1 },
      {
        id: 'get-spirit-seed-heartwood-approach',
        type: 'collectItem',
        targetId: 'spirit-seed-heartwood-approach',
        requiredCount: 1,
      },
      { id: 'restore-cedar-shrine', type: 'interactWithShrine', targetId: 'cedar-shrine-heart', requiredCount: 1 },
    ],
    reward: { xp: 60, gold: 30, spiritEssence: 15 },
  },
  'the-lost-library': {
    id: 'the-lost-library',
    prerequisiteQuestId: 'seeds-of-the-ancient-cedar',
    objectives: [
      { id: 'reach-heartwood-approach', type: 'reachLocation', targetId: 'heartwood-approach', requiredCount: 1 },
      { id: 'get-lost-library-records', type: 'collectItem', targetId: 'lost-library-records', requiredCount: 1 },
      { id: 'talk-elowen-report', type: 'talkToNpc', targetId: 'archivist-elowen', requiredCount: 1 },
    ],
    reward: { xp: 50, gold: 25, grantLoreId: 'lore-lost-library' },
  },
  'heartwood-sanctuary': {
    id: 'heartwood-sanctuary',
    prerequisiteQuestId: 'the-lost-library',
    objectives: [
      { id: 'talk-elowen-final', type: 'talkToNpc', targetId: 'archivist-elowen', requiredCount: 1 },
      { id: 'clear-sanctuary-entrance', type: 'defeatEnemies', targetId: 'corrupted-echo', requiredCount: 2 },
      { id: 'restore-sanctuary-gate', type: 'interactWithShrine', targetId: 'heartwood-sanctuary-gate', requiredCount: 1 },
    ],
    reward: { xp: 70, gold: 35, regionalReputation: 40, grantLoreId: 'lore-heartwood-sanctuary-gate' },
  },

  // --- Whispering Pines Side Quest (fresh, docs/Mytherra-SQ_breakdown.md had no pre-designed
  // entry for this region): The Heartwood Recordings - same 2-hidden-key-item, giver -> translator,
  // 2 quest-taught-Skills-+-Lore shape as Endless Prairie's own Winter Counts, gated behind Chapter
  // 7's own finale the same way Winter Counts gated behind Chapter 5's. ---
  'the-first-recording': {
    id: 'the-first-recording',
    prerequisiteQuestId: 'heartwood-sanctuary',
    objectives: [
      { id: 'get-heartwood-recording-i', type: 'collectItem', targetId: 'heartwood-recording-i', requiredCount: 1 },
      { id: 'talk-elowen-recording-i', type: 'talkToNpc', targetId: 'archivist-elowen', requiredCount: 1 },
      { id: 'talk-cedar-spirit-recording-i', type: 'talkToNpc', targetId: 'cedar-spirit', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'elderwood-ember', grantLoreId: 'heartwood-recording-i' },
  },
  'the-second-recording': {
    id: 'the-second-recording',
    prerequisiteQuestId: 'the-first-recording',
    objectives: [
      { id: 'get-heartwood-recording-ii', type: 'collectItem', targetId: 'heartwood-recording-ii', requiredCount: 1 },
      { id: 'talk-elowen-recording-ii', type: 'talkToNpc', targetId: 'archivist-elowen', requiredCount: 1 },
      { id: 'talk-cedar-spirit-recording-ii', type: 'talkToNpc', targetId: 'cedar-spirit', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'silver-rivers-chill', grantLoreId: 'heartwood-recording-ii' },
  },

  // --- Whispering Pines (MSQ Volume IV), Chapter 8: Echoes of the First Keepers ---
  // Kebab-case id mapping: MSF-WP-006 beneath-the-roots, MSF-WP-007 the-keeper-beneath-the-cedar,
  // MSF-WP-008 the-cedar-giant, MSF-WP-009 the-missing-pages. Gated behind Chapter 7's own true
  // finale, same "latest quest safely completed before this location is needed" rule as every
  // prior dungeon hand-off.
  'beneath-the-roots': {
    id: 'beneath-the-roots',
    prerequisiteQuestId: 'heartwood-sanctuary',
    objectives: [
      { id: 'reach-root-caverns', type: 'reachLocation', targetId: 'root-caverns', requiredCount: 1 },
      { id: 'get-archive-fragments', type: 'collectItem', targetId: 'archive-fragments', requiredCount: 1 },
      { id: 'reach-heartwood-lantern-sanctuary', type: 'reachLocation', targetId: 'heartwood-lantern-sanctuary', requiredCount: 1 },
    ],
    reward: { xp: 45, gold: 25, grantLoreId: 'lore-archive-fragments' },
  },
  'the-keeper-beneath-the-cedar': {
    id: 'the-keeper-beneath-the-cedar',
    prerequisiteQuestId: 'beneath-the-roots',
    objectives: [
      { id: 'get-lantern-of-ancient-roots', type: 'collectItem', targetId: 'lantern-of-ancient-roots', requiredCount: 1 },
      { id: 'talk-elowen-lantern', type: 'talkToNpc', targetId: 'archivist-elowen', requiredCount: 1 },
    ],
    reward: {
      xp: 50,
      gold: 0,
      itemIds: ['lantern-of-ancient-roots-equipped'],
      grantLoreId: 'lore-keeper-aldric-thorne',
    },
  },
  'the-cedar-giant': {
    id: 'the-cedar-giant',
    prerequisiteQuestId: 'the-keeper-beneath-the-cedar',
    objectives: [
      { id: 'reach-guardian-grove', type: 'reachLocation', targetId: 'guardian-grove', requiredCount: 1 },
      { id: 'defeat-cedar-giant', type: 'defeatBoss', targetId: 'cedar-giant', requiredCount: 1 },
    ],
    reward: { xp: 300, gold: 160, itemIds: ['cedar-giant-totem'] },
  },
  'the-missing-pages': {
    id: 'the-missing-pages',
    prerequisiteQuestId: 'the-cedar-giant',
    objectives: [
      { id: 'talk-elder-final', type: 'talkToNpc', targetId: 'elder-rowan-birch', requiredCount: 1 },
      { id: 'witness-cedar-shrine', type: 'interactWithShrine', targetId: 'cedar-shrine-heart', requiredCount: 1 },
    ],
    reward: {
      xp: 90,
      gold: 45,
      itemIds: ['guardian-memory-fragment-5', 'celestial-star-map'],
      regionalReputation: 65,
      grantLoreId: 'lore-guardian-memory-iv',
    },
  },

  // --- Shattered Desert (MSQ Volume V), Chapter 9: Beneath Forgotten Stars ---
  // Kebab-case id mapping: MSF-SD-001 the-desert-calls, MSF-SD-002 echoes-in-the-sand, MSF-SD-003
  // fragments-of-the-sky, MSF-SD-004 the-path-of-the-astronomers. Gated behind Volume IV's own
  // true finale, matching every prior volume hand-off.
  'the-desert-calls': {
    id: 'the-desert-calls',
    prerequisiteQuestId: 'the-missing-pages',
    objectives: [
      { id: 'reach-red-mesa', type: 'reachLocation', targetId: 'red-mesa', requiredCount: 1 },
      { id: 'talk-elder-santiago', type: 'talkToNpc', targetId: 'elder-santiago-ortega', requiredCount: 1 },
      { id: 'talk-scholar-nia', type: 'talkToNpc', targetId: 'scholar-nia-solis', requiredCount: 1 },
    ],
    reward: { xp: 30, gold: 20 },
  },
  'echoes-in-the-sand': {
    id: 'echoes-in-the-sand',
    prerequisiteQuestId: 'the-desert-calls',
    objectives: [
      { id: 'talk-nia-start', type: 'talkToNpc', targetId: 'scholar-nia-solis', requiredCount: 1 },
      { id: 'reach-sunfire-dunes', type: 'reachLocation', targetId: 'sunfire-dunes', requiredCount: 1 },
      { id: 'reach-crimson-canyons', type: 'reachLocation', targetId: 'crimson-canyons', requiredCount: 1 },
      { id: 'reach-celestial-oasis', type: 'reachLocation', targetId: 'celestial-oasis', requiredCount: 1 },
      { id: 'discover-star-crystal-shrine', type: 'interactWithShrine', targetId: 'star-crystal-shrine', requiredCount: 1 },
    ],
    reward: { xp: 25, gold: 15 },
  },
  'fragments-of-the-sky': {
    id: 'fragments-of-the-sky',
    prerequisiteQuestId: 'echoes-in-the-sand',
    objectives: [
      { id: 'get-star-fragment-sunfire-dunes', type: 'collectItem', targetId: 'star-fragment-sunfire-dunes', requiredCount: 1 },
      { id: 'get-star-fragment-crimson-canyons', type: 'collectItem', targetId: 'star-fragment-crimson-canyons', requiredCount: 1 },
      { id: 'get-star-fragment-painted-mesas', type: 'collectItem', targetId: 'star-fragment-painted-mesas', requiredCount: 1 },
      { id: 'restore-star-crystal-shrine', type: 'interactWithShrine', targetId: 'star-crystal-shrine', requiredCount: 1 },
    ],
    reward: { xp: 60, gold: 30, spiritEssence: 15 },
  },
  'the-path-of-the-astronomers': {
    id: 'the-path-of-the-astronomers',
    prerequisiteQuestId: 'fragments-of-the-sky',
    objectives: [
      { id: 'talk-nia-final', type: 'talkToNpc', targetId: 'scholar-nia-solis', requiredCount: 1 },
      { id: 'reach-forgotten-observatory-approach', type: 'reachLocation', targetId: 'forgotten-observatory-approach', requiredCount: 1 },
    ],
    reward: { xp: 80, gold: 40, regionalReputation: 45, grantLoreId: 'lore-forgotten-observatory-approach' },
  },

  // --- Shattered Desert Side Quest (fresh, docs/Mytherra-SQ_breakdown.md had no pre-designed
  // entry for this region): The Desert Relics - same 2-hidden-key-item, giver -> translator, 2
  // quest-taught-Skills-+-Lore shape as every prior region's own side quest, gated behind Chapter
  // 9's own finale. ---
  'the-first-relic': {
    id: 'the-first-relic',
    prerequisiteQuestId: 'the-path-of-the-astronomers',
    objectives: [
      { id: 'get-desert-relic-i', type: 'collectItem', targetId: 'desert-relic-i', requiredCount: 1 },
      { id: 'talk-tomas-relic-i', type: 'talkToNpc', targetId: 'desert-ranger-tomas-vega', requiredCount: 1 },
      { id: 'talk-nia-relic-i', type: 'talkToNpc', targetId: 'scholar-nia-solis', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'canyon-wildfire', grantLoreId: 'desert-relic-i' },
  },
  'the-second-relic': {
    id: 'the-second-relic',
    prerequisiteQuestId: 'the-first-relic',
    objectives: [
      { id: 'get-desert-relic-ii', type: 'collectItem', targetId: 'desert-relic-ii', requiredCount: 1 },
      { id: 'talk-tomas-relic-ii', type: 'talkToNpc', targetId: 'desert-ranger-tomas-vega', requiredCount: 1 },
      { id: 'talk-nia-relic-ii', type: 'talkToNpc', targetId: 'scholar-nia-solis', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'desert-nights-chill', grantLoreId: 'desert-relic-ii' },
  },

  // --- Shattered Desert (MSQ Volume V), Chapter 10: The Sky Remembers ---
  // Kebab-case id mapping: MSF-SD-005 the-celestial-machine, MSF-SD-006
  // lantern-of-forgotten-stars, MSF-SD-007 the-canyon-giant, MSF-SD-008 the-stars-never-lied.
  // Gated behind Chapter 9's own true finale, matching every prior dungeon hand-off.
  'the-celestial-machine': {
    id: 'the-celestial-machine',
    prerequisiteQuestId: 'the-path-of-the-astronomers',
    objectives: [
      { id: 'reach-inner-observatory', type: 'reachLocation', targetId: 'inner-observatory', requiredCount: 1 },
      { id: 'restore-celestial-mechanism', type: 'interactWithShrine', targetId: 'celestial-mechanism', requiredCount: 1 },
      { id: 'reach-star-chamber', type: 'reachLocation', targetId: 'star-chamber', requiredCount: 1 },
    ],
    reward: { xp: 45, gold: 25 },
  },
  'lantern-of-forgotten-stars': {
    id: 'lantern-of-forgotten-stars',
    prerequisiteQuestId: 'the-celestial-machine',
    objectives: [
      { id: 'get-lantern-of-forgotten-stars', type: 'collectItem', targetId: 'lantern-of-forgotten-stars', requiredCount: 1 },
      { id: 'talk-nia-lantern', type: 'talkToNpc', targetId: 'scholar-nia-solis', requiredCount: 1 },
    ],
    reward: {
      xp: 50,
      gold: 0,
      itemIds: ['lantern-of-forgotten-stars-equipped'],
      grantLoreId: 'lore-keeper-orion-vale',
    },
  },
  'the-canyon-giant': {
    id: 'the-canyon-giant',
    prerequisiteQuestId: 'lantern-of-forgotten-stars',
    objectives: [
      { id: 'reach-guardian-summit', type: 'reachLocation', targetId: 'guardian-summit', requiredCount: 1 },
      { id: 'defeat-canyon-giant', type: 'defeatBoss', targetId: 'canyon-giant', requiredCount: 1 },
    ],
    reward: { xp: 300, gold: 160, itemIds: ['canyon-giant-totem'] },
  },
  'the-stars-never-lied': {
    id: 'the-stars-never-lied',
    prerequisiteQuestId: 'the-canyon-giant',
    objectives: [
      { id: 'talk-santiago-final', type: 'talkToNpc', targetId: 'elder-santiago-ortega', requiredCount: 1 },
      { id: 'witness-star-crystal-shrine', type: 'interactWithShrine', targetId: 'star-crystal-shrine', requiredCount: 1 },
    ],
    reward: {
      xp: 90,
      gold: 45,
      itemIds: ['guardian-memory-fragment-6', 'frostward-star-chart'],
      regionalReputation: 65,
      grantLoreId: 'lore-guardian-memory-v',
    },
  },

  // --- Frozen Frontier (MSQ Volume VI), Chapter 11: Into the Endless Winter ---
  // Kebab-case id mapping: MSF-FF-001 northbound, MSF-FF-002 frozen-echoes, MSF-FF-003
  // light-within-the-ice, MSF-FF-004 hall-of-eternal-winter. Gated behind Volume V's own true
  // finale.
  'northbound': {
    id: 'northbound',
    prerequisiteQuestId: 'the-stars-never-lied',
    objectives: [
      { id: 'reach-frosthaven', type: 'reachLocation', targetId: 'frosthaven', requiredCount: 1 },
      { id: 'talk-astrid-arrival', type: 'talkToNpc', targetId: 'captain-astrid-frost', requiredCount: 1 },
      { id: 'talk-henrik-arrival', type: 'talkToNpc', targetId: 'elder-henrik', requiredCount: 1 },
    ],
    reward: { xp: 30, gold: 20 },
  },
  'frozen-echoes': {
    id: 'frozen-echoes',
    prerequisiteQuestId: 'northbound',
    objectives: [
      { id: 'talk-astrid-start', type: 'talkToNpc', targetId: 'captain-astrid-frost', requiredCount: 1 },
      { id: 'reach-snowveil-forest', type: 'reachLocation', targetId: 'snowveil-forest', requiredCount: 1 },
      { id: 'reach-frozen-river', type: 'reachLocation', targetId: 'frozen-river', requiredCount: 1 },
      { id: 'reach-aurora-basin', type: 'reachLocation', targetId: 'aurora-basin', requiredCount: 1 },
      { id: 'discover-winter-shrine', type: 'interactWithShrine', targetId: 'winter-shrine', requiredCount: 1 },
    ],
    reward: { xp: 25, gold: 15 },
  },
  'light-within-the-ice': {
    id: 'light-within-the-ice',
    prerequisiteQuestId: 'frozen-echoes',
    objectives: [
      { id: 'get-aurora-crystal-fragment-snowveil-forest', type: 'collectItem', targetId: 'aurora-crystal-fragment-snowveil-forest', requiredCount: 1 },
      { id: 'get-aurora-crystal-fragment-glacier-pass', type: 'collectItem', targetId: 'aurora-crystal-fragment-glacier-pass', requiredCount: 1 },
      { id: 'get-aurora-crystal-fragment-aurora-basin', type: 'collectItem', targetId: 'aurora-crystal-fragment-aurora-basin', requiredCount: 1 },
      { id: 'restore-winter-shrine', type: 'interactWithShrine', targetId: 'winter-shrine', requiredCount: 1 },
    ],
    reward: { xp: 60, gold: 30, spiritEssence: 15 },
  },
  'hall-of-eternal-winter': {
    id: 'hall-of-eternal-winter',
    prerequisiteQuestId: 'light-within-the-ice',
    objectives: [
      { id: 'talk-lyra-final', type: 'talkToNpc', targetId: 'aurora-keeper-lyra', requiredCount: 1 },
      { id: 'reach-hall-of-eternal-winter-approach', type: 'reachLocation', targetId: 'hall-of-eternal-winter-approach', requiredCount: 1 },
    ],
    reward: { xp: 80, gold: 40, regionalReputation: 45, grantLoreId: 'lore-hall-of-eternal-winter-approach' },
  },

  // --- Frozen Frontier Side Quest (fresh, docs/Mytherra-SQ_breakdown.md had no pre-designed entry
  // for this region): The Missing Scouts - same 2-hidden-key-item, giver -> translator, 2
  // quest-taught-Skills-+-Lore shape as every prior region's own side quest, gated behind Chapter
  // 11's own finale. Ties directly into Captain Astrid Frost's own arrival-quest dialogue about
  // scouts who never came back. ---
  'the-first-scout': {
    id: 'the-first-scout',
    prerequisiteQuestId: 'hall-of-eternal-winter',
    objectives: [
      { id: 'get-lost-scout-effects-i', type: 'collectItem', targetId: 'lost-scout-effects-i', requiredCount: 1 },
      { id: 'talk-astrid-scout-i', type: 'talkToNpc', targetId: 'captain-astrid-frost', requiredCount: 1 },
      { id: 'talk-lyra-scout-i', type: 'talkToNpc', targetId: 'aurora-keeper-lyra', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'aurora-flare', grantLoreId: 'lost-scout-effects-i' },
  },
  'the-second-scout': {
    id: 'the-second-scout',
    prerequisiteQuestId: 'the-first-scout',
    objectives: [
      { id: 'get-lost-scout-effects-ii', type: 'collectItem', targetId: 'lost-scout-effects-ii', requiredCount: 1 },
      { id: 'talk-astrid-scout-ii', type: 'talkToNpc', targetId: 'captain-astrid-frost', requiredCount: 1 },
      { id: 'talk-lyra-scout-ii', type: 'talkToNpc', targetId: 'aurora-keeper-lyra', requiredCount: 1 },
    ],
    reward: { xp: 40, gold: 25, grantSkillId: 'frostbite-shatter', grantLoreId: 'lost-scout-effects-ii' },
  },

  // --- Frozen Frontier (MSQ Volume VI), Chapter 12: The Last Memory ---
  // Kebab-case id mapping: MSF-FF-005 lantern-of-winters-resolve, MSF-FF-006 the-winter-stag,
  // MSF-FF-007 the-complete-memory, MSF-FF-008 a-new-dawn. Gated behind Chapter 11's own finale.
  'lantern-of-winters-resolve': {
    id: 'lantern-of-winters-resolve',
    prerequisiteQuestId: 'hall-of-eternal-winter',
    objectives: [
      { id: 'get-lantern-of-winters-resolve', type: 'collectItem', targetId: 'lantern-of-winters-resolve', requiredCount: 1 },
      { id: 'talk-lyra-lantern', type: 'talkToNpc', targetId: 'aurora-keeper-lyra', requiredCount: 1 },
    ],
    reward: {
      xp: 50,
      gold: 0,
      itemIds: ['lantern-of-winters-resolve-equipped'],
      grantLoreId: 'lore-keeper-eira-winterborn',
    },
  },
  'the-winter-stag': {
    id: 'the-winter-stag',
    prerequisiteQuestId: 'lantern-of-winters-resolve',
    objectives: [
      { id: 'reach-summit-of-winter', type: 'reachLocation', targetId: 'summit-of-winter', requiredCount: 1 },
      { id: 'defeat-winter-stag', type: 'defeatBoss', targetId: 'winter-stag', requiredCount: 1 },
    ],
    reward: { xp: 360, gold: 190, itemIds: ['eternal-stag-totem'] },
  },
  'the-complete-memory': {
    id: 'the-complete-memory',
    prerequisiteQuestId: 'the-winter-stag',
    objectives: [
      { id: 'reach-hall-of-memories', type: 'reachLocation', targetId: 'hall-of-memories', requiredCount: 1 },
      { id: 'witness-memory-altar', type: 'interactWithShrine', targetId: 'memory-altar', requiredCount: 1 },
    ],
    reward: {
      xp: 200,
      gold: 100,
      itemIds: ['guardian-memory-complete'],
      grantLoreId: 'lore-the-complete-memory',
    },
  },
  'a-new-dawn': {
    id: 'a-new-dawn',
    prerequisiteQuestId: 'the-complete-memory',
    objectives: [
      { id: 'reach-ash-hallow-finale', type: 'reachLocation', targetId: 'ash-hallow', requiredCount: 1 },
      { id: 'talk-elias-finale', type: 'talkToNpc', targetId: 'elias-rowan', requiredCount: 1 },
    ],
    reward: { xp: 500, gold: 250, regionalReputation: 100, grantLoreId: 'lore-a-new-dawn' },
  },
};

/** Ordered so UI/engine code can walk the chain; matches the MSQ's own quest order. */
export const QUEST_ORDER = [
  'a-new-keeper',
  'ash-hallow-tour',
  'the-first-flame',
  'beyond-the-lantern-light',
  'strange-tracks',
  'the-forgotten-shrine',
  'fragments-of-the-first-promise',
  'rekindling-spirit-grove',
  'shadows-on-raven-ridge',
  'beneath-hollow-rail',
  'into-hollow-rail',
  'the-lost-expedition',
  'embers-that-never-faded',
  'the-shrine-below',
  'the-coalbound-warden',
  'the-mountain-remembers',
  'frostbound-pages',
  'embers-beneath-stone',
  'a-long-road-south',
  'forgotten-names',
  'the-silent-grove',
  'seeds-of-memory',
  'beneath-still-waters',
  'into-the-deep-current',
  'reflections-of-the-past',
  'lantern-beneath-still-waters',
  'guardian-of-the-deep',
  'the-waters-remember',
  'the-drowned-ledger',
  'the-bogwater-almanac',
  'across-open-skies',
  'following-the-herd',
  'voices-on-the-wind',
  'the-stone-circles',
  'climbing-thunderbird-mesa',
  'the-first-winter-count',
  'the-second-winter-count',
  'temple-above-the-clouds',
  'keeper-of-the-open-sky',
  'the-great-thunderbird',
  'the-first-promise-remembered',
  'into-the-ancient-forest',
  'the-forest-has-fallen-silent',
  'seeds-of-the-ancient-cedar',
  'the-lost-library',
  'heartwood-sanctuary',
  'the-first-recording',
  'the-second-recording',
  'beneath-the-roots',
  'the-keeper-beneath-the-cedar',
  'the-cedar-giant',
  'the-missing-pages',
  'the-desert-calls',
  'echoes-in-the-sand',
  'fragments-of-the-sky',
  'the-path-of-the-astronomers',
  'the-first-relic',
  'the-second-relic',
  'the-celestial-machine',
  'lantern-of-forgotten-stars',
  'the-canyon-giant',
  'the-stars-never-lied',
  'northbound',
  'frozen-echoes',
  'light-within-the-ice',
  'hall-of-eternal-winter',
  'the-first-scout',
  'the-second-scout',
  'lantern-of-winters-resolve',
  'the-winter-stag',
  'the-complete-memory',
  'a-new-dawn',
];
