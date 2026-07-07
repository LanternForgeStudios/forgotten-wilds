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
      questIds: ['a-new-keeper', 'ash-hallow-tour', 'beyond-the-lantern-light', 'the-coalbound-warden', 'the-mountain-remembers'],
    },
    dialogueVariants: [
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
      { speaker: 'Nell Ashby', text: "You have GOT to hear about the lantern. THE lantern. The one that went missing in the mine." },
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
    gameplayHook: { type: 'questGiver', questIds: ['the-first-flame', 'fragments-of-the-first-promise', 'the-mountain-remembers'] },
    dialogueVariants: [
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
      { speaker: 'Mayor Eleanor Ashcroft', text: "Keep the lanterns lit and the roads clear — that's the whole of my platform, near enough." },
      { speaker: 'Mayor Eleanor Ashcroft', text: "Folks around here trust a Keeper more than they trust me, and that's exactly how it should be." },
    ],
    gameplayHook: { type: 'lore' },
  },
];
