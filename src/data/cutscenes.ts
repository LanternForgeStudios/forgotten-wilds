import { ENEMIES } from './enemies';

/** Generic fallback background for any cutscene without dedicated art - the same documented
 *  "no location-specific art" fallback battle-bg.forest already serves for Ash Hallow/interiors. */
const FALLBACK_CUTSCENE_BACKGROUND = 'battle-bg.forest';

/** Shown once, right after a brand new character is created (see CharacterCreationScene.tsx) -
 *  there's no persisted "have they seen it" flag on the account; a genuinely new character's own
 *  existence is the "first time" signal, so this only ever plays once by construction. */
export const INTRO_CUTSCENE = {
  backgroundAssetId: FALLBACK_CUTSCENE_BACKGROUND,
  lines: [
    'Long before the roads went quiet, the Great Spirits walked every ridge and creek of Mytherra.',
    'Then, without warning, they fell silent. The Iron Mountains grew strange - haunted by what memory could not let go.',
    'You are a Lantern Keeper: sworn to walk where others turn back, and to listen where the old stories are still half-remembered.',
    'Ash Hallow waits for you now. Carry your light well.',
  ],
};

/** Shown once per fresh sign-in for a RETURNING character (one who already has a save) - see
 *  App.tsx's bootstrap effect, which only ever runs this path once per auth transition (a cold
 *  page load or a fresh sign-in), never on later in-session map transitions back into Ash Hallow
 *  (those go through useLocationExploration.ts instead, which never touches this cutscene). */
export const WELCOME_BACK_CUTSCENE = {
  backgroundAssetId: FALLBACK_CUTSCENE_BACKGROUND,
  lines: [
    "The lantern catches, low and steady, and Ash Hallow's rooftops rise into view once more.",
    'A few familiar faces glance up as you pass - a nod here, a raised hand there.',
    "Welcome back, Keeper. The mountain remembers you, even when you're away.",
  ],
};

/** Shown when the player clicks Continue off a defeat overlay, before returning to Ash Hallow -
 *  see CombatScene.tsx's returnToExploration(). */
export const DEFEAT_CUTSCENE = {
  backgroundAssetId: 'background.defeat-cutscene',
  lines: [
    'Darkness - the ache of a hundred small hurts, and the weight of a hand on your shoulder.',
    '"Easy now," a voice says. "You\'re safe. We found you on the trail and brought you back."',
    "Firelight, and the smell of woodsmoke. Ash Hallow's Inn, and a bed that hasn't stopped being warm.",
    "You'll need more than luck to walk that road again. Rest first.",
  ],
};

interface QuestCutscene {
  backgroundAssetId: string;
  lines: string[];
  dramatic?: boolean;
}

/** Keyed by quest id - see hydrate.ts's toastQuestChanges, which plays the matching cutscene
 *  instead of the usual "Quest Completed" toast the moment one of these quests' status flips to
 *  'completed'. Only main-story beats significant enough to interrupt play belong here; everything
 *  else keeps the plain toast. */
export const QUEST_COMPLETION_CUTSCENES: Record<string, QuestCutscene> = {
  'rekindling-spirit-grove': {
    backgroundAssetId: 'background.quest-rekindling-spirit-grove',
    lines: [
      'The Guardian Sigil settles into its cradle, and the Lantern of the First Promise catches, low and steady.',
      'For a moment, the grove remembers what it was before the Silence - and something ancient stirs, just out of sight.',
      "The shrine will not forget this. Neither, you suspect, will you.",
    ],
  },
  'the-mountain-remembers': {
    backgroundAssetId: 'background.quest-the-mountain-remembers',
    lines: [
      'Elias Rowan listens to your account of the mine in silence, then sets a small, worn stone on the table between you.',
      '"A Guardian\'s memory," Miriam says quietly. "The first anyone\'s found in a generation."',
      'Within it: not abandonment, but a silence forced upon something that never chose to leave.',
      "The mountain remembers more than anyone has been willing to say aloud. It's time you understood why.",
    ],
  },
};

/** Built dynamically from the actual encounter roster (not static data, since it depends on which
 *  enemies were rolled) - see CombatScene.tsx's callStartEncounter response handler. Boss fights
 *  get their own dramatic beat (their loreBlurb, plus the shake/flash flourish); a regular/elite
 *  encounter gets one brief, skippable line so it never feels like it's standing between the
 *  player and the actual fight. */
export function battleStartCutscene(
  enemies: { enemyId: string; name: string; isBoss: boolean }[],
  backgroundAssetId: string,
): QuestCutscene {
  const boss = enemies.find((e) => e.isBoss);
  if (boss) {
    const loreBlurb = ENEMIES.find((e) => e.id === boss.enemyId)?.loreBlurb;
    return {
      backgroundAssetId,
      dramatic: true,
      lines: [
        `Something vast stirs in the dark ahead. ${boss.name}.`,
        ...(loreBlurb ? [loreBlurb] : []),
        'Steady your lantern. There is no turning back now.',
      ],
    };
  }
  const intro =
    enemies.length > 1 ? `${enemies.length} foes block your path!` : `A ${enemies[0]?.name ?? 'foe'} blocks your path!`;
  return {
    backgroundAssetId,
    lines: [intro],
  };
}
