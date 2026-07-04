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
      questIds: ['keepers-first-light', 'mothlight-on-the-ridge', 'the-coalbound-warden', 'guardians-call'],
    },
  },
  {
    id: 'mara-vale',
    name: 'Mara Vale',
    title: 'General Store Owner',
    spriteAssetId: 'sprite.npc.mara-vale',
    portraitAssetId: 'portrait.mara-vale',
    locationId: 'ash-hallow-mara-shop',
    dialogue: [
      { speaker: 'Mara Vale', text: "Welcome in. Mind the floorboard by the door, it's got opinions." },
      { speaker: 'Mara Vale', text: "Poultices, draughts, a bit of gear. Everything an Ash Hallow Keeper needs, more or less." },
    ],
    gameplayHook: { type: 'shop', shopId: 'mara-vale-general-store' },
  },
  {
    id: 'silas-flint',
    name: 'Silas Flint',
    title: 'Retired Miner',
    spriteAssetId: 'sprite.npc.silas-flint',
    portraitAssetId: 'portrait.silas-flint',
    locationId: 'ash-hallow',
    dialogue: [
      { speaker: 'Silas Flint', text: "Forty years in Hollow Rail. Left in a hurry, and not by choice." },
      {
        speaker: 'Silas Flint',
        text: "There's things down there that used to be men. I don't blame them for what they've become. I blame the mine.",
      },
      { speaker: 'Silas Flint', text: "If you're fool enough to go back in, go careful. Listen for the echoes." },
    ],
    gameplayHook: { type: 'questGiver', questIds: ['echoes-in-the-mine'] },
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
    gameplayHook: { type: 'questGiver', questIds: ['the-miners-lantern'] },
  },
];
