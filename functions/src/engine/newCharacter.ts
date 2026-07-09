import { STARTING_STATS } from '../data/leveling';
import type { Player, PlayerSave } from '../shared-types';

export const STARTING_LOCATION_ID = 'ash-hallow';

/** The exact starting stat block/equipment/location every new character (or a progress reset)
 *  begins with. Shared by createCharacter.ts and resetPlayerProgress.ts so the two can never
 *  silently drift apart. */
export function buildFreshPlayer(uid: string, name: string, now: number): Player {
  return {
    uid,
    name,
    level: 1,
    xp: 0,
    gold: 50,
    spiritEssence: 0,
    festivalTokens: 0,
    premiumCurrency: 0,
    stats: { ...STARTING_STATS },
    spiritRank: 'Unawakened',
    explorerRank: 'Newcomer',
    regionalReputation: 0,
    equipment: {
      weapon: null,
      armor: null,
      boots: null,
      gloves: null,
      charm: null,
      lantern: 'keepers-lantern',
      spiritTotem: null,
    },
    currentLocationId: STARTING_LOCATION_ID,
    staminaUpdatedAt: now,
  };
}

/** The rest of a fresh PlayerSave besides `player` - starting inventory (must include whatever's
 *  equipped by default, since equip/unequip never grant or destroy items) and initial journal. */
export function buildFreshSaveContent(): Pick<
  PlayerSave,
  'inventory' | 'quests' | 'journal' | 'openedChests' | 'seenNpcDialogueVariant' | 'lastReviewedSocialAt'
> {
  return {
    inventory: [
      { itemId: 'healing-poultice', quantity: 2 },
      { itemId: 'keepers-lantern', quantity: 1 },
    ],
    quests: {},
    journal: {
      creaturesDiscovered: [],
      locationsVisited: [STARTING_LOCATION_ID],
      loreUnlocked: ['lore-great-silence', 'lore-lantern-keepers'],
      bossesDefeated: [],
      // healing-poultice (an ITEMS-table entry) is in the starting inventory above - keepers-lantern
      // isn't included here since it's equipment, not an ITEMS entry (see grantItem's own comment).
      itemsDiscovered: ['healing-poultice'],
    },
    openedChests: [],
    seenNpcDialogueVariant: {},
    lastReviewedSocialAt: 0,
  };
}
