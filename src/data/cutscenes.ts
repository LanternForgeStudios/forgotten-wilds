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

/** Shown when the player clicks Continue off a defeat overlay, before returning to their region's
 *  own home town (not always Ash Hallow - see homeTownFor/CombatScene.tsx's returnToExploration()).
 *  A function rather than a flat const so the inn line names whichever town the player is actually
 *  being sent back to. */
export function buildDefeatCutscene(townName: string) {
  return {
    backgroundAssetId: 'background.defeat-cutscene',
    lines: [
      'Darkness - the ache of a hundred small hurts, and the weight of a hand on your shoulder.',
      '"Easy now," a voice says. "You\'re safe. We found you on the trail and brought you back."',
      `Firelight, and the smell of woodsmoke. ${townName}'s Inn, and a bed that hasn't stopped being warm.`,
      "You'll need more than luck to walk that road again. Rest first.",
    ],
  };
}

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

  // Crimson Bayou (MSQ Volume II)
  'seeds-of-memory': {
    backgroundAssetId: 'battle-bg.cypress-marsh',
    lines: [
      'The last Heart Seed settles into the cypress\'s roots, and for a long moment the whole marsh holds its breath.',
      'Then Mother Cypress wakes - slow as a season turning, but wakes all the same.',
      '"She remembers you now," the Marsh Spirit says. "Even the roots remember your name, small lantern-light."',
      "Somewhere in Mirehaven, someone's grandmother laughs, and doesn't know why it suddenly feels familiar.",
    ],
  },
  'the-waters-remember': {
    backgroundAssetId: 'battle-bg.temple-of-the-deep-current',
    lines: [
      'The memory rises out of the shrine like silt stirred from a riverbed - old, and slow to settle.',
      'Not abandonment, the vision shows you. A silence kept on purpose, by something that never stopped watching.',
      '"The archive\'s filling back in, memory by memory," Lucien says, setting the fragment carefully on his shelf.',
      "The Bayou's story finally has an ending worth writing down. It just isn't the one anyone expected.",
    ],
  },

  // Endless Prairie (MSQ Volume III)
  'voices-on-the-wind': {
    backgroundAssetId: 'battle-bg.sacred-hills',
    lines: [
      'The third Wind Stone settles into the shrine, and the wind changes - just slightly, just enough to notice.',
      '"Three stones held what the wind remembers," the Prairie Spirit says. "Scattered when the remembering stopped mattering to anyone."',
      'For a moment, the grass over Sacred Hills seems to lean the same direction, all at once, listening.',
      "Whatever the wind carried here, it isn't finished carrying it yet.",
    ],
  },
  'the-first-promise-remembered': {
    backgroundAssetId: 'battle-bg.stone-circle-valley',
    lines: [
      'The carvings at the Stone Circles catch the light differently this time, and the memory opens like a held breath finally released.',
      'Equals, it shows you - not master and servant, sealed together willingly, long before anyone thought to call it a debt.',
      '"Someone went to a great deal of trouble to make sure nobody remembered it that way," Chief Aiyana says quietly.',
      "You've just proven it can be un-rewritten. That matters more than she can easily say.",
    ],
  },

  // Whispering Pines (MSQ Volume IV)
  'seeds-of-the-ancient-cedar': {
    backgroundAssetId: 'battle-bg.ancient-cedar-shrine',
    lines: [
      'The third Spirit Seed takes root, and the shrine shudders - not with pain, but with growth, sudden and enormous.',
      '"Root, and root, and root again," the Cedar Spirit murmurs. "The forest reaching back through me, further than I could reach alone."',
      'I had forgotten what it felt like to be whole.',
      'This shrine will remember what you did here, long after I am withered again.',
    ],
  },
  'the-missing-pages': {
    backgroundAssetId: 'battle-bg.ancient-cedar-shrine',
    lines: [
      "The fourth memory unfolds slower than the others, reluctant, as if the shrine itself is unsure you're ready for it.",
      '"Deliberately emptied, not lost," Elder Rowan Birch says, turning the fragment over in his hands.',
      'A star map falls into place among the roots, pointing north and west, toward a desert none of you have seen with your own eyes.',
      "Cedarwatch will still be here when you're ready to follow it.",
    ],
  },

  // Shattered Desert (MSQ Volume V)
  'fragments-of-the-sky': {
    backgroundAssetId: 'battle-bg.celestial-oasis',
    lines: [
      'The third Star Fragment slides into place, and the crystal above the oasis flares, then steadies into a clean, quiet light.',
      '"Whole again," the Sand Spirit says, tilting her face toward the sky. "And the stars sharper for it already."',
      'I had forgotten how much of the sky I was supposed to be able to see.',
      'The old roads are opening now. Whatever waits at the Observatory has been waiting a very long time.',
    ],
  },
  'the-stars-never-lied': {
    backgroundAssetId: 'battle-bg.inner-observatory',
    lines: [
      "Five memories now, and for the first time, Elder Santiago Ortega doesn't reach for a page to explain what he's seeing.",
      '"The Great Silence wasn\'t done to the Guardians," he says slowly. "It was chosen - by Keepers and Guardians together, to save this world from something none of them wrote down."',
      "The Observatory's own star charts point north, past every road Red Mesa has ever mapped.",
      "The Frozen Frontier. That's where the last of it is waiting.",
    ],
  },

  // Frozen Frontier (MSQ Volume VI)
  'light-within-the-ice': {
    backgroundAssetId: 'battle-bg.aurora-basin',
    lines: [
      'The third Aurora Crystal Fragment locks into the shrine, and the sky over the basin catches - green, then violet, spreading slow as a held breath.',
      '"Whole again," the Winter Spirit says, and for the first time her voice doesn\'t shiver. "The first warmth this basin has felt since the sky went dark."',
      'I had forgotten what it was to not be cold.',
      'The road north is open now. Whatever waits in the Hall of Eternal Winter has been waiting for you specifically.',
    ],
  },
  'the-complete-memory': {
    backgroundAssetId: 'battle-bg.hall-of-memories',
    dramatic: true,
    lines: [
      'Six fragments, six regions, and for one long moment the Hall of Memories holds all of it at once - too much light, too much silence, too much to hold steady.',
      '"The Hollow," Aurora Keeper Lyra breathes. "I read the word in your face before you said it. None of us were ready to hear it named, even after everything."',
      'Worse than anyone guessed, because it was real. Better than anyone guessed, because they chose it - all of them, together, on purpose.',
      'Only the answer waiting here in this hall is left now. And it is finally, finally listening back.',
    ],
  },

  // Game finale
  'a-new-dawn': {
    backgroundAssetId: 'background.quest-a-new-dawn',
    dramatic: true,
    lines: [
      'Seven Lanterns, lit together, for the first time since before the Silence.',
      'Elias Rowan says it like a man setting down a weight he has carried since before you were born.',
      "Ash Hallow's rooftops catch the lantern-light differently tonight - warmer, somehow, like a held breath finally let go.",
      'The mountain remembers you, Keeper. Now, at last, so does everything else.',
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
