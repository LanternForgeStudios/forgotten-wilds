import { describe, expect, it } from 'vitest';
import { buildFreshPlayer, buildFreshSaveContent, STARTING_LOCATION_ID } from './newCharacter';

describe('buildFreshPlayer', () => {
  it('starts at level 1 with no progress', () => {
    const player = buildFreshPlayer('uid-1', 'Tester', 1000);
    expect(player.uid).toBe('uid-1');
    expect(player.name).toBe('Tester');
    expect(player.level).toBe(1);
    expect(player.xp).toBe(0);
    expect(player.gold).toBe(50);
    expect(player.spiritEssence).toBe(0);
    expect(player.festivalTokens).toBe(0);
    expect(player.premiumCurrency).toBe(0);
    expect(player.spiritRank).toBe('Unawakened');
    expect(player.explorerRank).toBe('Newcomer');
    expect(player.regionalReputation).toBe(0);
    expect(player.currentLocationId).toBe(STARTING_LOCATION_ID);
    expect(player.staminaUpdatedAt).toBe(1000);
  });

  it('equips the starting lantern and nothing else', () => {
    const player = buildFreshPlayer('uid-1', 'Tester', 1000);
    expect(player.equipment).toEqual({
      weapon: null,
      armor: null,
      boots: null,
      gloves: null,
      charm: null,
      lantern: 'keepers-lantern',
      spiritTotem: null,
    });
  });

  it('locks Stamina at 0/0 until the Guardian of Ironwood quest chain unlocks it', () => {
    const player = buildFreshPlayer('uid-1', 'Tester', 1000);
    expect(player.stats.stamina).toBe(0);
    expect(player.stats.maxStamina).toBe(0);
  });
});

describe('buildFreshSaveContent', () => {
  it('includes the starting lantern in inventory so it can be unequipped without being lost', () => {
    const content = buildFreshSaveContent();
    const lanternEntry = content.inventory.find((i) => i.itemId === 'keepers-lantern');
    expect(lanternEntry).toBeDefined();
    expect(lanternEntry?.quantity).toBeGreaterThanOrEqual(1);
  });

  it('starts with empty quests, no opened chests, and the starting location already visited', () => {
    const content = buildFreshSaveContent();
    expect(content.quests).toEqual({});
    expect(content.openedChests).toEqual([]);
    expect(content.journal.locationsVisited).toEqual([STARTING_LOCATION_ID]);
    expect(content.journal.creaturesDiscovered).toEqual([]);
    expect(content.journal.bossesDefeated).toEqual([]);
  });
});
