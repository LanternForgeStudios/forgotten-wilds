import { describe, expect, it } from 'vitest';
import { callAs, readPlayer, seedPlayer } from '../testUtils/firestoreTestEnv';
import { restAtInn } from './restAtInn';

// Isolation between tests (and any other emulator-backed test file running in parallel) comes
// from every test using its own never-reused uid - see firestoreTestEnv.ts's resetFirestore()
// doc comment for why there's deliberately no shared beforeEach wipe here.

const INN_REST_COST = 100;

// Every town's own inn - a regression test for exactly the bug this file's INN_LOCATION_IDS
// comment describes (cedarwatch/frosthaven/highwind-crossing/red-mesa were silently missing from
// that set even though their innkeeper NPCs open the same client-side Inn UI as the other two).
const ALL_INN_LOCATIONS = ['ash-hallow-inn', 'mirehaven-inn', 'cedarwatch-inn', 'frosthaven-inn', 'highwind-crossing-inn', 'red-mesa-inn'];

describe('restAtInn', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(restAtInn.run({ data: {}, auth: undefined })).rejects.toThrow();
  });

  it('rejects a uid with no character', async () => {
    await expect(callAs(restAtInn, 'u-no-character', {})).rejects.toThrow();
  });

  it('rejects resting from a location that is not an inn', async () => {
    const uid = 'u-not-at-inn';
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = 'ash-hallow'; // town square, not inside the inn
      s.player.gold = 1000;
    });
    await expect(callAs(restAtInn, uid, {})).rejects.toThrow();
  });

  it.each(ALL_INN_LOCATIONS)('allows resting at %s', async (locationId) => {
    const uid = `u-inn-${locationId}`;
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = locationId;
      s.player.gold = 1000;
      s.player.stats.hp = 1;
    });
    const result = await callAs(restAtInn, uid, {});
    expect(result.stats.hp).toBe(result.stats.maxHp);
  });

  it('rejects resting without enough gold, leaving stats untouched', async () => {
    const uid = 'u-poor';
    const save = await seedPlayer(uid, (s) => {
      s.player.currentLocationId = 'ash-hallow-inn';
      s.player.gold = 50; // rest costs 100
      s.player.stats.hp = 1;
    });
    await expect(callAs(restAtInn, uid, {})).rejects.toThrow();

    const persisted = await readPlayer(uid);
    expect(persisted.player.gold).toBe(save.player.gold);
    expect(persisted.player.stats.hp).toBe(1);
  });

  it('deducts INN_REST_COST and fully restores HP, Spirit, and (if equipped) Lantern Oil', async () => {
    const uid = 'u-full-rest';
    const save = await seedPlayer(uid, (s) => {
      s.player.currentLocationId = 'ash-hallow-inn';
      s.player.gold = 500;
      s.player.stats.hp = 1;
      s.player.stats.spirit = 0;
      s.player.stats.lanternOil = 0;
      // Fresh characters already start with keepers-lantern equipped.
    });
    const result = await callAs(restAtInn, uid, {});
    expect(result.gold).toBe(save.player.gold - INN_REST_COST);
    expect(result.stats.hp).toBe(result.stats.maxHp);
    expect(result.stats.spirit).toBe(result.stats.maxSpirit);
    expect(result.stats.lanternOil).toBe(result.stats.maxLanternOil);

    const persisted = await readPlayer(uid);
    expect(persisted.player.gold).toBe(save.player.gold - INN_REST_COST);
  });

  it('does not restore Lantern Oil when no lantern is equipped', async () => {
    const uid = 'u-no-lantern';
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = 'ash-hallow-inn';
      s.player.gold = 500;
      s.player.stats.hp = 1;
      s.player.stats.lanternOil = 5;
      s.player.stats.maxLanternOil = 30;
      s.player.equipment.lantern = null;
    });
    const result = await callAs(restAtInn, uid, {});
    expect(result.stats.hp).toBe(result.stats.maxHp); // still fully healed
    expect(result.stats.lanternOil).toBe(5); // unchanged - no lantern to refill
  });
});
