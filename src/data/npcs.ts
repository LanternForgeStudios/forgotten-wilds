import type { Npc } from '@/types';

export const NPCS: Npc[] = [
  {
    id: 'elias-rowan',
    name: 'Elias Rowan',
    title: 'Lantern Keeper Mentor',
    spriteAssetId: 'sprite.npc.elias-rowan',
    portraitAssetId: 'portrait.elias-rowan',
    locationId: 'ash-hallow-elias-house',
    dialogue: [
      { speaker: 'Elias Rowan', text: 'So. Another lantern, another Keeper. Ash Hallow could use one.' },
      {
        speaker: 'Elias Rowan',
        text: 'The Great Silence took more than spirits from these mountains — it took the paths between us and them. We walk those paths back, one quiet act at a time.',
      },
      {
        speaker: 'Elias Rowan',
        text: 'Start simple. Light your lantern. Walk the ridge. Listen more than you speak.',
      },
    ],
    gameplayHook: {
      type: 'questGiver',
      questIds: [
        'a-new-keeper',
        'ash-hallow-tour',
        'beyond-the-lantern-light',
        'the-coalbound-warden',
        'the-mountain-remembers',
        'frostbound-pages',
        'embers-beneath-stone',
      ],
    },
    dialogueVariants: [
      {
        questId: 'embers-beneath-stone',
        lines: [
          { speaker: 'Elias Rowan', text: "The Ember Codex, whole and translated. Two forgotten disciplines recovered in as many months — the Order is stronger for it." },
          { speaker: 'Elias Rowan', text: "You've earned a rest. There will be more manuscripts to find, in time, but not tonight." },
        ],
      },
      {
        questId: 'frostbound-pages',
        lines: [
          { speaker: 'Elias Rowan', text: "Frost Lance, restored after all this time. Miriam tells me there's a second volume that may belong to the same collection." },
          { speaker: 'Elias Rowan', text: "Worth chasing, if you're willing. The mountains don't give up their history easily." },
        ],
      },
      {
        questId: 'the-mountain-remembers',
        lines: [
          { speaker: 'Elias Rowan', text: "The mountain remembers now. So do I — more than I expected to, and less than I'd like." },
          { speaker: 'Elias Rowan', text: "The Guardians didn't abandon us. Someone silenced them. That changes everything I thought I understood about the First Promise." },
          { speaker: 'Elias Rowan', text: "The answers keep pointing south, toward the Bayou. Rest before you go. You've earned that much." },
        ],
      },
      {
        questId: 'the-coalbound-warden',
        lines: [
          { speaker: 'Elias Rowan', text: "Hollow Rail is quiet again. Silas hasn't stopped talking about it since you got back." },
          { speaker: 'Elias Rowan', text: "There's a memory waiting to be assembled, if the old accounts are right. I think it's time we found out what it holds." },
        ],
      },
      {
        questId: 'beyond-the-lantern-light',
        lines: [
          { speaker: 'Elias Rowan', text: "So you've left Ash Hallow's light behind and come back in one piece. Good. That's the first real test, and you passed it." },
          { speaker: 'Elias Rowan', text: "Ironwood Trail's troubles run deeper than a few frightened Echoes, I think. Keep your eyes open out there." },
        ],
      },
      {
        questId: 'ash-hallow-tour',
        lines: [
          { speaker: 'Elias Rowan', text: "You've met the whole town now, and the shrine's flame is lit. Ash Hallow trusts you a little more for it." },
          { speaker: 'Elias Rowan', text: "It won't be long before I send you past the gates. Make the most of the quiet while it lasts." },
        ],
      },
      {
        questId: 'a-new-keeper',
        lines: [
          { speaker: 'Elias Rowan', text: "The vows are taken, the lantern's yours. Feels lighter than you expected, doesn't it? It won't stay that way." },
          { speaker: 'Elias Rowan', text: "Go learn this town before I ask you to leave it. Ash Hallow's worth knowing." },
        ],
      },
    ],
  },
  {
    id: 'finn-rowan',
    name: 'Finn Rowan',
    title: "Elias's Nephew",
    spriteAssetId: 'sprite.npc.finn-rowan',
    portraitAssetId: 'portrait.finn-rowan',
    locationId: 'ash-hallow-elias-house',
    dialogue: [
      { speaker: 'Finn Rowan', text: "Uncle Elias talks like every lantern's a life-or-death matter. Most days it's just oil and paperwork." },
      { speaker: 'Finn Rowan', text: "Don't let him fool you into thinking he was born stern. Ask him about the Bayou sometime, when he's had a drink." },
    ],
    gameplayHook: { type: 'lore' },
  },
  {
    id: 'mara-ash',
    name: 'Mara Ash',
    title: 'General Store Owner',
    spriteAssetId: 'sprite.npc.mara-ash',
    portraitAssetId: 'portrait.mara-ash',
    locationId: 'ash-hallow-mara-shop',
    dialogue: [
      { speaker: 'Mara Ash', text: "Welcome in. Mind the floorboard by the door, it's got opinions." },
      { speaker: 'Mara Ash', text: "Poultices, draughts, a bit of gear. Everything an Ash Hallow Keeper needs, more or less." },
    ],
    gameplayHook: { type: 'shop', shopId: 'mara-ash-general-store' },
  },
  {
    id: 'silas-flint',
    name: 'Silas Flint',
    title: 'Mine Office Foreman',
    spriteAssetId: 'sprite.npc.silas-flint',
    portraitAssetId: 'portrait.silas-flint',
    locationId: 'ash-hallow-mine-office',
    dialogue: [
      { speaker: 'Silas Flint', text: "Forty years in Hollow Rail. Left in a hurry, and not by choice." },
      {
        speaker: 'Silas Flint',
        text: "There's things down there that used to be men. I don't blame them for what they've become. I blame the mine.",
      },
      { speaker: 'Silas Flint', text: "If you're fool enough to go back in, go careful. Listen for the echoes." },
    ],
    gameplayHook: { type: 'questGiver', questIds: ['beneath-hollow-rail', 'into-hollow-rail', 'the-shrine-below'] },
    dialogueVariants: [
      {
        questId: 'the-shrine-below',
        lines: [
          { speaker: 'Silas Flint', text: "Shrine's lit again, down where I never thought light would sit easy. Mine Heart's open now. That's on you." },
          { speaker: 'Silas Flint', text: "Whatever's waiting in there, finish it. Forty years of listening to those echoes is enough for one lifetime." },
        ],
      },
      {
        questId: 'into-hollow-rail',
        lines: [
          { speaker: 'Silas Flint', text: "You're in deeper than any Keeper's gone in years. Aldric Vale's supplies, you said? Then it's true. He never left." },
          { speaker: 'Silas Flint', text: "Find that shrine. If anything down there can still be put right, it's that." },
        ],
      },
      {
        questId: 'beneath-hollow-rail',
        lines: [
          { speaker: 'Silas Flint', text: "You went in. Most don't, once they've heard me talk about it." },
          { speaker: 'Silas Flint', text: "Upper shafts cleared, you said. Don't let that fool you into thinking the worst of it is behind you." },
        ],
      },
    ],
  },
  {
    id: 'juniper-reed',
    name: 'Juniper Reed',
    title: 'Innkeeper',
    spriteAssetId: 'sprite.npc.juniper-reed',
    portraitAssetId: 'portrait.juniper-reed',
    locationId: 'ash-hallow-inn',
    dialogue: [
      { speaker: 'Juniper Reed', text: 'Bed and a warm meal, gold on the table. Rest as long as the lantern-light holds.' },
      { speaker: 'Juniper Reed', text: "You look ridge-worn. Sit a while before you fall over." },
    ],
    gameplayHook: { type: 'inn', innId: 'juniper-reed-inn' },
  },
  {
    id: 'nell-ashby',
    name: 'Nell Ashby',
    title: 'Folklore Collector',
    spriteAssetId: 'sprite.npc.nell-ashby',
    portraitAssetId: 'portrait.nell-ashby',
    locationId: 'ash-hallow',
    dialogue: [
      { speaker: 'Nell Ashby', text: "You simply must hear about the lantern - the one that vanished into Hollow Rail and never came back, not even as a story two people tell the same way." },
      {
        speaker: 'Nell Ashby',
        text: "Every old miner tells it differently, which means there's a real story buried somewhere under all of them.",
      },
      { speaker: 'Nell Ashby', text: "If you find it — the real lantern, not another campfire story — I want to know everything." },
    ],
    gameplayHook: { type: 'questGiver', questIds: ['the-lost-expedition', 'embers-that-never-faded'] },
    dialogueVariants: [
      {
        questId: 'embers-that-never-faded',
        lines: [
          { speaker: 'Nell Ashby', text: "You actually found it. The Miner's Lost Lantern, real as anything, and every campfire story wrong in a different way." },
          { speaker: 'Nell Ashby', text: "I'm rewriting three chapters tonight. Come back when you've got another one nobody believes." },
        ],
      },
      {
        questId: 'the-lost-expedition',
        lines: [
          { speaker: 'Nell Ashby', text: "So the miners' story is real — a Keeper really did stay behind. Aldric Vale. I never once heard that name right." },
          { speaker: 'Nell Ashby', text: "If his lantern's still down there somewhere, I need it in my collection. Or at least in my notes." },
        ],
      },
    ],
  },
  {
    id: 'aldren-stone',
    name: 'Aldren Stone',
    title: 'Blacksmith',
    spriteAssetId: 'sprite.npc.aldren-stone',
    portraitAssetId: 'portrait.aldren-stone',
    locationId: 'ash-hallow-blacksmith',
    dialogue: [
      { speaker: 'Aldren Stone', text: "Forge's always hot. Mountain doesn't care whose watch it is." },
      { speaker: 'Aldren Stone', text: "Staffs, charms, the odd totem when one turns up. Weapons and warding — that's my end of the street." },
    ],
    gameplayHook: { type: 'shop', shopId: 'ash-hallow-blacksmith-forge' },
  },
  {
    id: 'tessa-ironhand',
    name: 'Tessa Ironhand',
    title: 'Armorer',
    spriteAssetId: 'sprite.npc.tessa-ironhand',
    portraitAssetId: 'portrait.tessa-ironhand',
    locationId: 'ash-hallow-armory',
    dialogue: [
      { speaker: 'Tessa Ironhand', text: "Aldren handles what hits. I handle what keeps you standing after it does." },
      { speaker: 'Tessa Ironhand', text: "Coats, boots, gloves — fitted, not just sized. Come back when the mountain's worn through what you're wearing." },
    ],
    gameplayHook: { type: 'shop', shopId: 'ash-hallow-armory' },
  },
  {
    id: 'willow-briar',
    name: 'Willow Briar',
    title: 'Apothecary',
    spriteAssetId: 'sprite.npc.willow-briar',
    portraitAssetId: 'portrait.willow-briar',
    locationId: 'ash-hallow-apothecary',
    dialogue: [
      { speaker: 'Willow Briar', text: "Mind the fumes by the door. Everything in here is stronger than it smells." },
      { speaker: 'Willow Briar', text: "Poultices, draughts, oil for the lantern-hearted. Whatever's keeping you upright, I've probably got it." },
    ],
    gameplayHook: { type: 'shop', shopId: 'apothecary' },
  },
  {
    id: 'historian-miriam',
    name: 'Historian Miriam',
    title: 'Town Historian',
    spriteAssetId: 'sprite.npc.historian-miriam',
    portraitAssetId: 'portrait.historian-miriam',
    locationId: 'ash-hallow-archive',
    dialogue: [
      { speaker: 'Historian Miriam', text: "Ash Hallow wasn't always the name. Before the Silence, the old maps called it something else entirely." },
      { speaker: 'Historian Miriam', text: "I've got three shelves of that history and no one to read it to but the mice. Ask me anytime." },
    ],
    gameplayHook: {
      type: 'questGiver',
      questIds: ['the-first-flame', 'fragments-of-the-first-promise', 'the-mountain-remembers', 'frostbound-pages', 'embers-beneath-stone'],
    },
    dialogueVariants: [
      {
        questId: 'embers-beneath-stone',
        lines: [
          { speaker: 'Historian Miriam', text: "The Ember Codex confirms it — Lantern Keepers who traveled with the Hollow Rail miners, learning to burn away corruption instead of consuming it." },
          { speaker: 'Historian Miriam', text: "Ember Burst is yours now. Two disciplines restored. I wonder how many more are still buried in these mountains." },
        ],
      },
      {
        questId: 'frostbound-pages',
        lines: [
          { speaker: 'Historian Miriam', text: "The Frostbound Treatise, translated at last. Lantern Keepers once calmed winter spirits rather than fought them — Frost Lance is the proof of it." },
          { speaker: 'Historian Miriam', text: "There may be a second volume. If it's out there, I'd very much like to read it." },
        ],
      },
      {
        questId: 'the-mountain-remembers',
        lines: [
          { speaker: 'Historian Miriam', text: "A Guardian Memory, assembled whole. I've spent my life reading fragments — I never thought I'd see one complete." },
          { speaker: 'Historian Miriam', text: "The Guardians were silenced, not gone. I'll be corresponding with the Bayou about this for months." },
        ],
      },
      {
        questId: 'fragments-of-the-first-promise',
        lines: [
          { speaker: 'Historian Miriam', text: "The Sigil, whole again. Three fragments, three corners of Ironwood Trail — someone wanted that shrine forgotten." },
          { speaker: 'Historian Miriam', text: "Guardian Sigils aren't decoration. They're memory made solid. Whatever broke that one didn't do it by accident." },
        ],
      },
      {
        questId: 'the-first-flame',
        lines: [
          { speaker: 'Historian Miriam', text: "You rekindled the Town Shrine yourself? Elias will want to hear every detail." },
          { speaker: 'Historian Miriam', text: "Shrines remember. That's the whole of what I know for certain, and somehow it's still not enough." },
        ],
      },
      // Shown while the-first-flame is active but not yet completed (ash-hallow-tour is its
      // prerequisite, and no later-listed variant's quest is complete yet at that point) - the
      // "why shrines matter" beat the-first-flame's own description promises, delivered before the
      // player lights it rather than after (that's what the questId: 'the-first-flame' variant
      // above is for - the post-completion reaction).
      {
        questId: 'ash-hallow-tour',
        lines: [
          { speaker: 'Historian Miriam', text: "Every shrine in Mytherra is bound to something living, or something that used to be. Light one, and you're not lighting a lamp - you're reminding a memory how to breathe." },
          { speaker: 'Historian Miriam', text: "The Town Shrine's sat dark since before I was born. Go on - I'll want to know exactly how it felt." },
        ],
      },
    ],
  },
  {
    id: 'hunter-garrick',
    name: 'Hunter Garrick',
    title: 'Tracker',
    spriteAssetId: 'sprite.npc.hunter-garrick',
    portraitAssetId: 'portrait.hunter-garrick',
    locationId: 'ironwood-trail',
    dialogue: [
      { speaker: 'Hunter Garrick', text: "Tracks all wrong out here lately. Too light, or too deep, like whatever made them wasn't sure it had feet." },
      { speaker: 'Hunter Garrick', text: "Follow the Spirit Tracks if you want answers. I've gone as far as I'm willing to go alone." },
    ],
    gameplayHook: { type: 'questGiver', questIds: ['strange-tracks', 'shadows-on-raven-ridge'] },
    dialogueVariants: [
      {
        questId: 'shadows-on-raven-ridge',
        lines: [
          { speaker: 'Hunter Garrick', text: "Raven Ridge checks out, more or less — but whatever's stirring, it's coming up from Hollow Rail Mine." },
          { speaker: 'Hunter Garrick', text: "Tell Elias what you found. I've done my part of the tracking. The mine's Silas's problem now, and yours." },
        ],
      },
      {
        questId: 'strange-tracks',
        lines: [
          { speaker: 'Hunter Garrick', text: "First Echo down and the tracks keep going. Whatever's out there, it's not alone." },
          { speaker: 'Hunter Garrick', text: "Ranger Caleb knows the Ridge better than I do. Find him if the trail keeps climbing." },
        ],
      },
    ],
  },
  {
    id: 'spirit-child',
    name: 'Spirit Child',
    title: 'Voice of the Grove',
    spriteAssetId: 'sprite.npc.spirit-child',
    portraitAssetId: 'portrait.spirit-child',
    locationId: 'ironwood-trail',
    dialogue: [
      { speaker: 'Spirit Child', text: "You hear it too, don't you? The quiet where a song should be." },
      { speaker: 'Spirit Child', text: "Someone took the Sigil. Without it, the grove cannot remember how to wake." },
    ],
    gameplayHook: { type: 'questGiver', questIds: ['the-forgotten-shrine', 'rekindling-spirit-grove'] },
    dialogueVariants: [
      {
        questId: 'rekindling-spirit-grove',
        lines: [
          { speaker: 'Spirit Child', text: "The grove remembers its song now. Can you hear it? I couldn't, before you came." },
          { speaker: 'Spirit Child', text: "The Echoes are quieter here. Not gone — but they're not so afraid anymore either." },
        ],
      },
      {
        questId: 'the-forgotten-shrine',
        lines: [
          { speaker: 'Spirit Child', text: "You found the missing Sigil's trail. Historian Miriam will know more about it than I do." },
          { speaker: 'Spirit Child', text: "Bring the pieces back to me, when you have them all. The grove has waited long enough." },
        ],
      },
    ],
  },
  {
    id: 'ranger-caleb',
    name: 'Ranger Caleb',
    title: 'Ridge Scout',
    spriteAssetId: 'sprite.npc.ranger-caleb',
    portraitAssetId: 'portrait.ranger-caleb',
    locationId: 'raven-ridge',
    dialogue: [
      { speaker: 'Ranger Caleb', text: "Old rail line used to run supplies down to Hollow Rail. Hasn't moved a cart in years." },
      { speaker: 'Ranger Caleb', text: "Whatever's wrong with that mine, it's not staying put anymore. Tell Silas, if you see him." },
    ],
    gameplayHook: { type: 'lore' },
  },
  {
    id: 'mayor-eleanor-ashcroft',
    name: 'Mayor Eleanor Ashcroft',
    title: 'Mayor of Ash Hallow',
    spriteAssetId: 'sprite.npc.mayor-eleanor-ashcroft',
    portraitAssetId: 'portrait.mayor-eleanor-ashcroft',
    locationId: 'ash-hallow-town-hall',
    dialogue: [
      { speaker: 'Mayor Eleanor Ashcroft', text: "Ash Hallow's stood at this crossroads since before the Silence, and it'll stand after whatever's coming too - so long as someone keeps the lanterns lit." },
      { speaker: 'Mayor Eleanor Ashcroft', text: "Folks around here trust a Keeper more than they trust me, and that's exactly how it should be." },
    ],
    gameplayHook: { type: 'lore' },
  },

  // --- Crimson Bayou (MSQ Volume II) ---
  {
    id: 'mayor-celeste-broussard',
    name: 'Mayor Celeste Broussard',
    title: 'Mayor of Mirehaven',
    spriteAssetId: 'sprite.npc.mayor-celeste-broussard',
    portraitAssetId: 'portrait.mayor-celeste-broussard',
    locationId: 'mirehaven-town-hall',
    dialogue: [
      { speaker: 'Mayor Celeste Broussard', text: "A Lantern Keeper, this far south? Elias Rowan's letters said you might come. Welcome to Mirehaven - mind the boardwalks after dark, they don't always agree on which way is down." },
      { speaker: 'Mayor Celeste Broussard', text: "Half this town can't remember their own grandmother's name anymore. I'd call it strange, if strange still meant anything out here." },
    ],
    gameplayHook: { type: 'questGiver', questIds: ['the-drowned-ledger', 'the-bogwater-almanac'] },
    dialogueVariants: [
      {
        questId: 'the-bogwater-almanac',
        lines: [
          { speaker: 'Mayor Celeste Broussard', text: "The Bogwater Almanac, and the Drowned Ledger before it - two whole volumes of the town's own history, pulled back out of the silt." },
          { speaker: 'Mayor Celeste Broussard', text: "Lucien hasn't stopped talking about it. Mirehaven owes you more than it can put in a ledger of its own, Keeper." },
        ],
      },
      {
        questId: 'the-drowned-ledger',
        lines: [
          { speaker: 'Mayor Celeste Broussard', text: "The Drowned Ledger, whole again. Half the names in there I hadn't heard spoken since before the Silence." },
          { speaker: 'Mayor Celeste Broussard', text: "If there's a second volume out there in the marsh, I'd very much like Lucien to see it." },
        ],
      },
      {
        questId: 'the-waters-remember',
        lines: [
          { speaker: 'Mayor Celeste Broussard', text: "The names are coming back, one porch at a time. I remember my own grandmother's laugh again - I'd nearly lost it for good." },
          { speaker: 'Mayor Celeste Broussard', text: "Whatever you woke beneath that temple, Keeper, it's given Mirehaven something it hasn't had in years: a future worth remembering." },
        ],
      },
      {
        questId: 'seeds-of-memory',
        lines: [
          { speaker: 'Mayor Celeste Broussard', text: "Mother Cypress stirs again - half the boardwalk's talking about the color coming back to the marsh." },
          { speaker: 'Mayor Celeste Broussard', text: "Whatever's happening beneath the water now, I trust you to see it through the same as you did her." },
        ],
      },
    ],
  },
  {
    id: 'lucien-boudreaux',
    name: 'Lucien Boudreaux',
    title: 'Bayou Historian',
    spriteAssetId: 'sprite.npc.lucien-boudreaux',
    portraitAssetId: 'portrait.lucien-boudreaux',
    locationId: 'mirehaven-archive',
    dialogue: [
      { speaker: 'Lucien Boudreaux', text: "Every shelf in this archive is fighting the damp, and losing. Half these records will be pulp before I finish reading them." },
      { speaker: 'Lucien Boudreaux', text: "It's not corruption spreading through the Bayou, Keeper. It's forgetting. Names, faces, whole family lines - gone quiet, like a candle with no one left to remember lighting it." },
    ],
    gameplayHook: {
      type: 'questGiver',
      questIds: ['the-bogwater-almanac', 'the-drowned-ledger', 'forgotten-names', 'seeds-of-memory', 'reflections-of-the-past'],
    },
    dialogueVariants: [
      {
        questId: 'the-bogwater-almanac',
        lines: [
          { speaker: 'Lucien Boudreaux', text: "Hush of the Reeds, restored from the Almanac's second volume. A rougarou's howl won't get the chance to turn into a claw, not with this." },
          { speaker: 'Lucien Boudreaux', text: "Two Keeper disciplines pulled out of the silt in as many weeks. I don't know what else this marsh is still keeping from us." },
        ],
      },
      {
        questId: 'the-drowned-ledger',
        lines: [
          { speaker: 'Lucien Boudreaux', text: "The Drowned Ledger's translated at last. Marsh Toxin, they called it - turning the swamp's own venom back on its creatures." },
          { speaker: 'Lucien Boudreaux', text: "There's a second volume mentioned in the margins, the Bogwater Almanac. If it's still out there, I'd like very much to read it." },
        ],
      },
      {
        questId: 'the-waters-remember',
        lines: [
          { speaker: 'Lucien Boudreaux', text: "The archive's filling back in, memory by memory. I've started a new shelf just for what you brought back." },
          { speaker: 'Lucien Boudreaux', text: "Historian Miriam will want every page of this. The Bayou's story finally has an ending worth writing down." },
        ],
      },
      {
        questId: 'reflections-of-the-past',
        lines: [
          { speaker: 'Lucien Boudreaux', text: "Those temple records confirmed what I feared - the memory-loss was never natural. Something down there has been feeding on it." },
          { speaker: 'Lucien Boudreaux', text: "Sabine's going to need you again, and soon. Whatever's beneath the temple isn't finished." },
        ],
      },
    ],
  },
  {
    id: 'marsh-spirit',
    name: 'Marsh Spirit',
    title: 'Voice of Cypress Marsh',
    spriteAssetId: 'sprite.npc.marsh-spirit',
    portraitAssetId: 'portrait.marsh-spirit',
    locationId: 'cypress-marsh',
    dialogue: [
      { speaker: 'Marsh Spirit', text: '...another lantern-light. Small and stubborn, like the last one.' },
      { speaker: 'Marsh Spirit', text: "Mother Cypress sleeps without her Heart Seed. Find it, and she may wake enough to remember what took it." },
    ],
    gameplayHook: { type: 'questGiver', questIds: ['the-silent-grove'] },
    dialogueVariants: [
      {
        questId: 'the-waters-remember',
        lines: [
          { speaker: 'Marsh Spirit', text: 'The marsh sings again. Even the roots remember your name now, small lantern-light.' },
        ],
      },
      {
        questId: 'seeds-of-memory',
        lines: [
          { speaker: 'Marsh Spirit', text: 'Mother Cypress wakes, slow as a season turning. She remembers you now.' },
          { speaker: 'Marsh Spirit', text: '...go on. The river still hides something she cannot see from her roots.' },
        ],
      },
    ],
  },
  {
    id: 'sabine-thorne',
    name: 'Warden Sabine Thorne',
    title: 'River Warden',
    spriteAssetId: 'sprite.npc.sabine-thorne',
    portraitAssetId: 'portrait.sabine-thorne',
    locationId: 'hidden-river-landing',
    dialogue: [
      { speaker: 'Warden Sabine Thorne', text: "Water's been rising where it's got no business rising. Not storm-water either - something underneath is pushing it up." },
      { speaker: 'Warden Sabine Thorne', text: "I've kept this landing safe for eleven years. Whatever's down there, I mean to know what it is before it decides for me." },
    ],
    gameplayHook: { type: 'questGiver', questIds: ['beneath-still-waters', 'guardian-of-the-deep'] },
    dialogueVariants: [
      {
        questId: 'the-waters-remember',
        lines: [
          { speaker: 'Warden Sabine Thorne', text: "The river's gone quiet in the good way now. Eleven years I kept this landing - you gave it back its future in a season." },
        ],
      },
      {
        questId: 'guardian-of-the-deep',
        lines: [
          { speaker: 'Warden Sabine Thorne', text: 'The Guardian sleeps easy now, and so will I, for the first time in longer than I care to admit.' },
        ],
      },
      {
        questId: 'beneath-still-waters',
        lines: [
          { speaker: 'Warden Sabine Thorne', text: "You found the temple entrance. Good. Now the real question starts - what's actually down there, and what it wants." },
        ],
      },
    ],
  },
  {
    id: 'innkeep-odette',
    name: 'Odette',
    title: 'Innkeeper',
    spriteAssetId: 'sprite.npc.innkeep-odette',
    portraitAssetId: 'portrait.innkeep-odette',
    locationId: 'mirehaven-inn',
    dialogue: [
      { speaker: 'Odette', text: "Rooms sway with the current, but the roof's tight and the stew's hot. Rest as long as you need, Keeper." },
      { speaker: 'Odette', text: "Half my regulars stopped remembering why they keep coming back. I still remember why I keep the door open, at least." },
    ],
    gameplayHook: { type: 'inn', innId: 'odette-inn' },
    dialogueVariants: [
      {
        questId: 'the-waters-remember',
        lines: [
          { speaker: 'Odette', text: 'My regulars are back, and they remember why they used to come. That\'s worth more to me than the coin.' },
        ],
      },
      {
        questId: 'lantern-beneath-still-waters',
        lines: [
          { speaker: 'Odette', text: "Word's spreading about that lantern you pulled from beneath the temple. Half the bar's asking after it." },
        ],
      },
    ],
  },
  {
    id: 'merchant-remy',
    name: 'Remy',
    title: 'General Store Owner',
    spriteAssetId: 'sprite.npc.merchant-remy',
    portraitAssetId: 'portrait.merchant-remy',
    locationId: 'mirehaven-general-store',
    dialogue: [
      { speaker: 'Remy', text: "River trade brings a bit of everything through Mirehaven, eventually. Take a look, take your pick." },
      { speaker: 'Remy', text: "Lantern oil, antidotes, the odd curiosity off a trade barge. Ask if you don't see it - I probably know someone who's got it." },
    ],
    gameplayHook: { type: 'shop', shopId: 'remy-general-store' },
    dialogueVariants: [
      {
        questId: 'the-waters-remember',
        lines: [
          { speaker: 'Remy', text: "Trade's actually good now - people are coming back to Mirehaven instead of just passing through." },
        ],
      },
      {
        questId: 'beneath-still-waters',
        lines: [
          { speaker: 'Remy', text: "Whatever's down in that temple, it's got Sabine spooked, and she doesn't spook easy. Watch yourself out there." },
        ],
      },
    ],
  },
  {
    id: 'blacksmith-toussaint',
    name: 'Toussaint',
    title: 'Blacksmith',
    spriteAssetId: 'sprite.npc.blacksmith-toussaint',
    portraitAssetId: 'portrait.blacksmith-toussaint',
    locationId: 'mirehaven-blacksmith',
    dialogue: [
      { speaker: 'Toussaint', text: "Forge stays lit even when the damp gets into everything else. Bayou iron's stubborn that way." },
      { speaker: 'Toussaint', text: "Cypress canes and a few warded charms, all Bayou-made. Take a look at the racks." },
    ],
    gameplayHook: { type: 'shop', shopId: 'toussaint-forge' },
    dialogueVariants: [
      {
        questId: 'seeds-of-memory',
        lines: [
          { speaker: 'Toussaint', text: "Finally finished a piece worth the warding - a charm strong enough to shrug off a bog witch's poison. It's yours if you want it." },
        ],
      },
    ],
  },
  {
    id: 'armorer-delphine',
    name: 'Delphine',
    title: 'Armorer',
    spriteAssetId: 'sprite.npc.armorer-delphine',
    portraitAssetId: 'portrait.armorer-delphine',
    locationId: 'mirehaven-armory',
    dialogue: [
      { speaker: 'Delphine', text: "Mire-treated leather, fitted to actually move in. Ash Hallow gear wasn't built for water up to your knees." },
      { speaker: 'Delphine', text: "Vestments, leg-wraps, boots, gloves - all cut for wading, not walking. Have a look." },
    ],
    gameplayHook: { type: 'shop', shopId: 'delphine-armory' },
  },
  {
    id: 'herbalist-noelle',
    name: 'Noelle',
    title: 'Herbalist',
    spriteAssetId: 'sprite.npc.herbalist-noelle',
    portraitAssetId: 'portrait.herbalist-noelle',
    locationId: 'mirehaven-herbalist',
    dialogue: [
      { speaker: 'Noelle', text: "Bayou's generous if you know where to look. Half these tonics grew within a mile of this shelf." },
      { speaker: 'Noelle', text: "Poultices, draughts, something for the ailments that come with wet feet and worse water. Take what you need." },
    ],
    gameplayHook: { type: 'shop', shopId: 'noelle-herbalist' },
    dialogueVariants: [
      {
        questId: 'the-waters-remember',
        lines: [
          { speaker: 'Noelle', text: 'Even the herbs smell different now - sharper, like the marsh itself is breathing easier.' },
        ],
      },
      {
        questId: 'seeds-of-memory',
        lines: [
          { speaker: 'Noelle', text: "Mother Cypress waking up changed the whole marsh overnight. My tonics have never worked better." },
        ],
      },
    ],
  },
];
