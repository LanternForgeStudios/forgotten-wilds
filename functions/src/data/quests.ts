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
    /** A Specialty Attack id (data/skills.ts) to add to Player.knownSkillIds on completion -
     *  plumbing for future quest-taught Specialty Attacks (see CombatScene.tsx's "Select Spirit
     *  Ability" submenu). No quest uses this yet. */
    grantSkillId?: string;
    /** Unlocks Stamina/Dash on completion (see interactWithShrine.ts) - a generic reward flag
     *  rather than a hardcoded quest id check, the same way grantSkillId is generic rather than a
     *  hardcoded skill-quest special case. Only 'rekindling-spirit-grove' sets this today. */
    grantsStaminaUnlock?: boolean;
    /** A lore entry id (src/data/lore.ts - client-display-only, no server-side copy of the text)
     *  to add to JournalState.loreUnlocked on completion. */
    grantLoreId?: string;
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
    reward: { xp: 10, gold: 20, itemIds: ['travelers-cloak'] },
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
    objectives: [{ id: 'light-shrine', type: 'interactWithShrine', targetId: 'ash-hallow-shrine', requiredCount: 1 }],
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
];
