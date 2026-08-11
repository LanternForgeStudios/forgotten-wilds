import { STARTING_STATS } from '../data/leveling';
import { freshPlayerEquipment } from './equipmentEngine';
import type { Player, PlayerSave } from '../shared-types';

export const STARTING_LOCATION_ID = 'ash-hallow';

/** The exact starting stat block/equipment/location every new character (or a progress reset)
 *  begins with. Shared by createCharacter.ts and resetPlayerProgress.ts so the two can never
 *  silently drift apart. `gender`/`appearance` default if omitted (resetPlayerProgress.ts doesn't
 *  ask again - it keeps whatever the player already had, see its own call site). */
export function buildFreshPlayer(
  uid: string,
  name: string,
  now: number,
  gender: 'male' | 'female' = 'male',
  appearance: 'white-dark' | 'black-dark' | 'white-blonde' | 'asian-dark' = 'white-dark',
): Player {
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
    regionalReputationRank: 'Stranger',
    equipment: { ...freshPlayerEquipment(), lantern: 'keepers-lantern' },
    currentLocationId: STARTING_LOCATION_ID,
    staminaUpdatedAt: now,
    knownSkillIds: ['keepers-strike'],
    gender,
    appearance,
    lastChestClaimedAt: 0,
    lanternOilUpgrades: {},
    difficulty: 'medium',
  };
}

/** The rest of a fresh PlayerSave besides `player` - starting inventory (must include whatever's
 *  equipped by default, since equip/unequip never grant or destroy items) and initial journal. */
export function buildFreshSaveContent(): Pick<
  PlayerSave,
  'inventory' | 'quests' | 'journal' | 'openedChests' | 'seenNpcDialogueVariant' | 'lastReviewedSocialAt' | 'apothecaryQuests'
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
      // Both starting inventory entries above, matching grantItem's own behavior (it records both
      // ITEMS-table and EQUIPMENT-table ids into itemsDiscovered) - a fresh character already
      // starts owning/wearing keepers-lantern, so it should already read as "discovered" in the
      // Journal's Items tab too, not just healing-poultice.
      itemsDiscovered: ['healing-poultice', 'keepers-lantern'],
    },
    openedChests: [],
    seenNpcDialogueVariant: {},
    lastReviewedSocialAt: 0,
    apothecaryQuests: {},
  };
}
