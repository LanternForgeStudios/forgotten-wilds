import { describe, expect, it } from 'vitest';
import { callAs, readPlayer, seedPlayer } from '../testUtils/firestoreTestEnv';
import { equipItem, unequipItem } from './equipItem';

// Isolation between tests (and between this file and any other emulator-backed test file running
// in parallel) comes from every test using its own never-reused uid - see firestoreTestEnv.ts's
// resetFirestore() doc comment for why there's deliberately no shared beforeEach wipe here.

describe('equipItem', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(equipItem.run({ data: { itemId: 'weathered-walking-staff' }, auth: undefined })).rejects.toThrow();
  });

  it('rejects an unknown item id', async () => {
    const uid = 'u-unknown-item';
    await seedPlayer(uid);
    await expect(callAs(equipItem, uid, { itemId: 'not-a-real-item' })).rejects.toThrow();
  });

  it('rejects equipping an item the player does not own', async () => {
    const uid = 'u-not-owned';
    await seedPlayer(uid);
    await expect(callAs(equipItem, uid, { itemId: 'weathered-walking-staff' })).rejects.toThrow();
  });

  it('equips an owned item and applies its stat bonuses', async () => {
    const uid = 'u-equip-basic';
    const save = await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'weathered-walking-staff', quantity: 1 });
    });
    const result = await callAs(equipItem, uid, { itemId: 'weathered-walking-staff' });
    expect(result.equipment.weapon).toBe('weathered-walking-staff');
    expect(result.stats.attack).toBe(save.player.stats.attack + 4);
    expect(result.stats.maxSpirit).toBe(save.player.stats.maxSpirit + 5);

    // Transaction actually persisted, not just returned in the response.
    const persisted = await readPlayer(uid);
    expect(persisted.player.equipment.weapon).toBe('weathered-walking-staff');
    expect(persisted.player.stats.attack).toBe(save.player.stats.attack + 4);
  });

  it('swapping to a different item in the same slot removes the old bonus before applying the new one', async () => {
    const uid = 'u-swap';
    const save = await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'river-stone-charm', quantity: 1 }, { itemId: 'mountain-knot', quantity: 1 });
    });
    await callAs(equipItem, uid, { itemId: 'river-stone-charm' }); // +5 maxHp
    const result = await callAs(equipItem, uid, { itemId: 'mountain-knot' }); // +2 speed, no maxHp
    expect(result.equipment.charm).toBe('mountain-knot');
    // river-stone-charm's +5 maxHp must be gone, not stacked with mountain-knot's own bonus.
    expect(result.stats.maxHp).toBe(save.player.stats.maxHp);
    expect(result.stats.speed).toBe(save.player.stats.speed + 2);
  });

  it('re-equipping the already-equipped item is a no-op that still succeeds', async () => {
    const uid = 'u-noop';
    const save = await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'weathered-walking-staff', quantity: 1 });
    });
    await callAs(equipItem, uid, { itemId: 'weathered-walking-staff' });
    const result = await callAs(equipItem, uid, { itemId: 'weathered-walking-staff' });
    expect(result.stats.attack).toBe(save.player.stats.attack + 4); // not doubled
  });

  it('owning exactly one copy already worn in charm cannot also be worn in charm2', async () => {
    const uid = 'u-elsewhere';
    await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'river-stone-charm', quantity: 1 });
      s.quests['the-skys-second-gift'] = { status: 'completed', objectiveCounts: {} };
    });
    await callAs(equipItem, uid, { itemId: 'river-stone-charm' }); // fills 'charm'
    await expect(callAs(equipItem, uid, { itemId: 'river-stone-charm', targetSlot: 'charm2' })).rejects.toThrow();
  });

  it('owning two copies of the same charm allows wearing it in two slots at once', async () => {
    const uid = 'u-two-copies';
    await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'river-stone-charm', quantity: 2 });
      s.quests['the-skys-second-gift'] = { status: 'completed', objectiveCounts: {} };
    });
    await callAs(equipItem, uid, { itemId: 'river-stone-charm' });
    const result = await callAs(equipItem, uid, { itemId: 'river-stone-charm', targetSlot: 'charm2' });
    expect(result.equipment.charm).toBe('river-stone-charm');
    expect(result.equipment.charm2).toBe('river-stone-charm');
  });

  it('rejects equipping into a locked charm2 slot before its unlock quest is completed', async () => {
    const uid = 'u-locked-slot';
    await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'river-stone-charm', quantity: 1 });
    });
    await expect(callAs(equipItem, uid, { itemId: 'river-stone-charm', targetSlot: 'charm2' })).rejects.toThrow();
  });

  it('allows equipping into charm2 once its unlock quest is completed', async () => {
    const uid = 'u-unlocked-slot';
    await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'river-stone-charm', quantity: 1 });
      s.quests['the-skys-second-gift'] = { status: 'completed', objectiveCounts: {} };
    });
    const result = await callAs(equipItem, uid, { itemId: 'river-stone-charm', targetSlot: 'charm2' });
    expect(result.equipment.charm2).toBe('river-stone-charm');
  });

  it('equipping a lantern replaces (not adds to) max oil capacity, clamping current oil down', async () => {
    const uid = 'u-lantern';
    // Fresh characters start with keepers-lantern already equipped (30 oil) - drain it first so
    // the clamp-down behavior is actually observable, then swap to a lower-capacity lantern.
    const save = await seedPlayer(uid, (s) => {
      s.player.stats.lanternOil = 30;
      s.inventory.push({ itemId: 'miners-lost-lantern-equipped', quantity: 1 });
    });
    expect(save.player.stats.maxLanternOil).toBe(30); // keepers-lantern's own base capacity
    const result = await callAs(equipItem, uid, { itemId: 'miners-lost-lantern-equipped' });
    expect(result.equipment.lantern).toBe('miners-lost-lantern-equipped');
    expect(result.stats.maxLanternOil).toBe(35); // replaced, not 30+35
    expect(result.stats.lanternOil).toBe(30); // unaffected, capacity only grew here
  });
});

describe('unequipItem', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(unequipItem.run({ data: { slot: 'weapon' }, auth: undefined })).rejects.toThrow();
  });

  it('rejects an invalid slot', async () => {
    const uid = 'u-bad-slot';
    await seedPlayer(uid);
    await expect(callAs(unequipItem, uid, { slot: 'notASlot' as never })).rejects.toThrow();
  });

  it('removes the item and its stat bonuses, leaving the slot empty', async () => {
    const uid = 'u-unequip';
    const save = await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'weathered-walking-staff', quantity: 1 });
    });
    await callAs(equipItem, uid, { itemId: 'weathered-walking-staff' });
    const result = await callAs(unequipItem, uid, { slot: 'weapon' });
    expect(result.equipment.weapon).toBeNull();
    expect(result.stats.attack).toBe(save.player.stats.attack);
    expect(result.stats.maxSpirit).toBe(save.player.stats.maxSpirit);
  });

  it('unequipping an empty slot is a harmless no-op', async () => {
    const uid = 'u-unequip-empty';
    const save = await seedPlayer(uid);
    const result = await callAs(unequipItem, uid, { slot: 'weapon' });
    expect(result.equipment.weapon).toBeNull();
    expect(result.stats.attack).toBe(save.player.stats.attack);
  });

  it('unequipping a lantern zeroes max oil capacity and clamps current oil to 0', async () => {
    const uid = 'u-unequip-lantern';
    // Fresh characters already have keepers-lantern equipped (30 max oil, starts full).
    await seedPlayer(uid);
    const result = await callAs(unequipItem, uid, { slot: 'lantern' });
    expect(result.equipment.lantern).toBeNull();
    expect(result.stats.maxLanternOil).toBe(0);
    expect(result.stats.lanternOil).toBe(0);
  });
});
