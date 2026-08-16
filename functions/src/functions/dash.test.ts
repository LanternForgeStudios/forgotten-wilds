import { describe, expect, it } from 'vitest';
import { callAs, readPlayer, seedPlayer } from '../testUtils/firestoreTestEnv';
import { dash } from './dash';

// Isolation between tests (and any other emulator-backed test file running in parallel) comes
// from every test using its own never-reused uid - see firestoreTestEnv.ts's resetFirestore()
// doc comment for why there's deliberately no shared beforeEach wipe here.

const DASH_COST_PER_TILE = 3;
const FULL_REGEN_SECONDS = 20;

describe('dash', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(dash.run({ data: {}, auth: undefined })).rejects.toThrow();
  });

  it('rejects a request for a uid with no character', async () => {
    await expect(callAs(dash, 'u-no-character', {})).rejects.toThrow();
  });

  it('rejects a player who has not unlocked Dash yet (maxStamina 0)', async () => {
    const uid = 'u-not-unlocked';
    // Fresh characters start with maxStamina 0 (locked until the Guardian of Ironwood quest
    // chain) - no override needed, this is the real starting state.
    await seedPlayer(uid);
    await expect(callAs(dash, uid, {})).rejects.toThrow();
  });

  it('spends exactly DASH_COST_PER_TILE with no time elapsed', async () => {
    const uid = 'u-basic-spend';
    const now = Date.now();
    await seedPlayer(uid, (s) => {
      s.player.stats.maxStamina = 40;
      s.player.stats.stamina = 40;
      s.player.staminaUpdatedAt = now;
    });
    const result = await callAs(dash, uid, {});
    expect(result.stamina).toBe(40 - DASH_COST_PER_TILE);
    expect(result.maxStamina).toBe(40);

    const persisted = await readPlayer(uid);
    expect(persisted.player.stats.stamina).toBe(40 - DASH_COST_PER_TILE);
  });

  it('rejects a dash with insufficient stamina and no time elapsed to regen', async () => {
    const uid = 'u-insufficient';
    const now = Date.now();
    await seedPlayer(uid, (s) => {
      s.player.stats.maxStamina = 40;
      s.player.stats.stamina = 1; // less than DASH_COST_PER_TILE (3)
      s.player.staminaUpdatedAt = now;
    });
    await expect(callAs(dash, uid, {})).rejects.toThrow();

    // Transaction must have rolled back entirely - nothing persisted, not even the (zero) regen.
    const persisted = await readPlayer(uid);
    expect(persisted.player.stats.stamina).toBe(1);
    expect(persisted.player.staminaUpdatedAt).toBe(now);
  });

  it('regenerates stamina based on elapsed time before spending', async () => {
    const uid = 'u-partial-regen';
    const now = Date.now();
    await seedPlayer(uid, (s) => {
      s.player.stats.maxStamina = 40;
      s.player.stats.stamina = 0;
      // 10 of the 20-second full-regen window elapsed -> ~20 Stamina regenerated (40/20 * 10).
      s.player.staminaUpdatedAt = now - 10_000;
    });
    const result = await callAs(dash, uid, {});
    // Allow slack for real wall-clock time passing between seeding and the call itself.
    expect(result.stamina).toBeGreaterThan(20 - DASH_COST_PER_TILE - 1);
    expect(result.stamina).toBeLessThan(20 - DASH_COST_PER_TILE + 1);
  });

  it('never regenerates past maxStamina even after a very long elapsed time', async () => {
    const uid = 'u-full-regen-cap';
    const now = Date.now();
    await seedPlayer(uid, (s) => {
      s.player.stats.maxStamina = 40;
      s.player.stats.stamina = 0;
      // Far more than FULL_REGEN_SECONDS has elapsed - regen must clamp at maxStamina, not
      // overshoot proportionally to elapsed time.
      s.player.staminaUpdatedAt = now - (FULL_REGEN_SECONDS + 500) * 1000;
    });
    const result = await callAs(dash, uid, {});
    expect(result.stamina).toBe(40 - DASH_COST_PER_TILE);
  });

  it('updates staminaUpdatedAt to the time of the successful dash', async () => {
    const uid = 'u-timestamp';
    const before = Date.now();
    await seedPlayer(uid, (s) => {
      s.player.stats.maxStamina = 40;
      s.player.stats.stamina = 40;
      s.player.staminaUpdatedAt = before - 5000;
    });
    const result = await callAs(dash, uid, {});
    const after = Date.now();
    expect(result.staminaUpdatedAt).toBeGreaterThanOrEqual(before);
    expect(result.staminaUpdatedAt).toBeLessThanOrEqual(after);
  });

  it('only touches stamina/staminaUpdatedAt/updatedAt, leaving the rest of the save untouched', async () => {
    const uid = 'u-targeted-update';
    const now = Date.now();
    const save = await seedPlayer(uid, (s) => {
      s.player.stats.maxStamina = 40;
      s.player.stats.stamina = 40;
      s.player.staminaUpdatedAt = now;
    });
    await callAs(dash, uid, {});
    const persisted = await readPlayer(uid);
    expect(persisted.inventory).toEqual(save.inventory);
    expect(persisted.quests).toEqual(save.quests);
    expect(persisted.player.gold).toBe(save.player.gold);
    expect(persisted.player.equipment).toEqual(save.player.equipment);
  });
});
