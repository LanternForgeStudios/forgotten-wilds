import type { Quest } from '@/types';

export const QUESTS: Quest[] = [
  {
    id: 'keepers-first-light',
    name: "The Keeper's First Light",
    giverNpcId: 'elias-rowan',
    description: 'Speak with Elias Rowan and take up your lantern as a new Lantern Keeper.',
    prerequisiteQuestId: null,
    objectives: [
      {
        id: 'talk-elias',
        type: 'talkToNpc',
        description: 'Speak with Elias Rowan in Ash Hallow.',
        targetId: 'elias-rowan',
        requiredCount: 1,
      },
    ],
    reward: { xp: 10, gold: 20 },
  },
  {
    id: 'mothlight-on-the-ridge',
    name: 'Mothlight on the Ridge',
    giverNpcId: 'elias-rowan',
    description: 'Mothlings have grown bold on Ironwood Trail. Thin their numbers.',
    prerequisiteQuestId: 'keepers-first-light',
    objectives: [
      {
        id: 'defeat-mothlings',
        type: 'defeatEnemies',
        description: 'Defeat 3 Mothlings on Ironwood Trail.',
        targetId: 'mothling',
        requiredCount: 3,
      },
    ],
    reward: { xp: 30, gold: 35, itemIds: ['healing-poultice'] },
  },
  {
    id: 'echoes-in-the-mine',
    name: 'Echoes in the Mine',
    giverNpcId: 'silas-flint',
    description: 'Silas Flint asks you to investigate Hollow Rail Mine, the place he once called work.',
    prerequisiteQuestId: 'mothlight-on-the-ridge',
    objectives: [
      {
        id: 'reach-mine',
        type: 'reachLocation',
        description: 'Reach Hollow Rail Mine.',
        targetId: 'hollow-rail-mine',
        requiredCount: 1,
      },
    ],
    reward: { xp: 25, gold: 20 },
  },
  {
    id: 'the-miners-lantern',
    name: "The Miner's Lantern",
    giverNpcId: 'nell-ashby',
    description: 'Recover the lost lantern relic said to be buried somewhere in Hollow Rail Mine.',
    prerequisiteQuestId: 'echoes-in-the-mine',
    objectives: [
      {
        id: 'collect-lantern',
        type: 'collectItem',
        description: "Recover the Miner's Lost Lantern from Hollow Rail Mine.",
        targetId: 'miners-lost-lantern',
        requiredCount: 1,
      },
    ],
    reward: { xp: 40, gold: 25, itemIds: ['miners-lost-lantern-equipped'] },
  },
  {
    id: 'the-coalbound-warden',
    name: 'The Coalbound Warden',
    giverNpcId: 'elias-rowan',
    description: 'Something ancient and grieving guards the deep of Hollow Rail Mine. Face it, and calm it if you can.',
    prerequisiteQuestId: 'the-miners-lantern',
    objectives: [
      {
        id: 'defeat-warden',
        type: 'defeatBoss',
        description: 'Defeat the Coalbound Warden.',
        targetId: 'coalbound-warden',
        requiredCount: 1,
      },
    ],
    reward: { xp: 150, gold: 100, itemIds: ['wardens-ember-heart'] },
  },
  {
    id: 'guardians-call',
    name: "The Guardian's Call",
    giverNpcId: 'elias-rowan',
    description: 'The Warden is calmed. Elias asked to hear how it went - return to him in Ash Hallow.',
    prerequisiteQuestId: 'the-coalbound-warden',
    objectives: [
      {
        id: 'talk-elias-after-warden',
        type: 'talkToNpc',
        description: 'Report back to Elias Rowan in Ash Hallow.',
        targetId: 'elias-rowan',
        requiredCount: 1,
      },
    ],
    reward: { xp: 20, gold: 15 },
  },
  {
    id: 'guardians-trial',
    name: "The Guardian's Trial",
    giverNpcId: 'elias-rowan',
    description:
      "Elias speaks of an older shrine on Ironwood Trail, and something that still watches over it. Find it.",
    prerequisiteQuestId: 'guardians-call',
    objectives: [
      {
        id: 'find-guardian',
        type: 'interactWithShrine',
        description: 'Find the shrine on Ironwood Trail and speak with the Guardian.',
        targetId: 'guardian-of-ironwood',
        requiredCount: 1,
      },
    ],
    reward: { xp: 20, gold: 15 },
  },
  {
    id: 'guardians-proof',
    name: "The Guardian's Proof",
    giverNpcId: 'guardian-of-ironwood',
    description: 'The Guardian will not teach its ways to the untested. Prove your resolve on the trail.',
    prerequisiteQuestId: 'guardians-trial',
    objectives: [
      {
        id: 'prove-resolve',
        type: 'defeatEnemies',
        description: 'Defeat 5 Mothlings on Ironwood Trail.',
        targetId: 'mothling',
        requiredCount: 5,
      },
    ],
    reward: { xp: 40, gold: 30 },
  },
  {
    id: 'guardians-blessing',
    name: "The Guardian's Blessing",
    giverNpcId: 'guardian-of-ironwood',
    description: 'Return to the shrine and report what you have done.',
    prerequisiteQuestId: 'guardians-proof',
    objectives: [
      {
        id: 'report-to-guardian',
        type: 'interactWithShrine',
        description: 'Return to the Guardian of Ironwood.',
        targetId: 'guardian-of-ironwood',
        requiredCount: 1,
      },
    ],
    reward: { xp: 60, gold: 40 },
  },
];
