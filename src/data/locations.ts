import type { Location } from '@/types';

export const LOCATIONS: Location[] = [
  {
    id: 'ash-hallow',
    name: 'Ash Hallow',
    kind: 'town',
    description: 'A small mountain town at the foot of the Iron Mountains, and home to the Lantern Keepers\' waystation.',
    mapAssetId: 'map.ash-hallow',
    battleBackgroundAssetId: 'battle-bg.forest',
    encounterTable: [],
    npcIds: ['elias-rowan', 'mara-vale', 'silas-flint', 'juniper-reed', 'nell-ashby'],
  },
  {
    id: 'ironwood-trail',
    name: 'Ironwood Trail',
    kind: 'overworld',
    description: 'A winding ridge trail through haunted forest, said to be favored by Mothling swarms after dusk.',
    mapAssetId: 'map.ironwood-trail',
    battleBackgroundAssetId: 'battle-bg.forest',
    encounterTable: [
      { enemyId: 'mothling', weight: 3 },
      { enemyId: 'greater-mothling', weight: 1 },
    ],
    npcIds: [],
  },
  {
    id: 'hollow-rail-mine',
    name: 'Hollow Rail Mine',
    kind: 'dungeon',
    description: 'An abandoned mine and its collapsed rail line, haunted by the miners who never left and the coal spirits that grew from their grief.',
    mapAssetId: 'map.hollow-rail-mine',
    battleBackgroundAssetId: 'battle-bg.dungeon',
    encounterTable: [
      { enemyId: 'restless-miner', weight: 2 },
      { enemyId: 'foreman-wraith', weight: 1 },
      { enemyId: 'coal-spirit', weight: 2 },
      { enemyId: 'coal-wraith', weight: 1 },
    ],
    npcIds: [],
  },
];
