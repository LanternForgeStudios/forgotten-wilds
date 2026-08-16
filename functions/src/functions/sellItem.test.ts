import { describe, expect, it } from 'vitest';
import { callAs, readPlayer, seedPlayer } from '../testUtils/firestoreTestEnv';
import { sellItem } from './sellItem';

// Isolation between tests (and any other emulator-backed test file running in parallel) comes
// from every test using its own never-reused uid - see firestoreTestEnv.ts's resetFirestore()
// doc comment for why there's deliberately no shared beforeEach wipe here.

describe('sellItem', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(sellItem.run({ data: { itemId: 'healing-poultice' }, auth: undefined })).rejects.toThrow();
  });

  it('rejects a missing itemId', async () => {
    const uid = 'u-no-item';
    await seedPlayer(uid);
    await expect(callAs(sellItem, uid, { itemId: '' })).rejects.toThrow();
  });

  it('rejects a non-numeric quantity', async () => {
    const uid = 'u-bad-quantity';
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'healing-poultice', quantity: 5 }];
    });
    await expect(callAs(sellItem, uid, { itemId: 'healing-poultice', quantity: 'a lot' as never })).rejects.toThrow();
  });

  it('rejects an item that has no sell price at all (unknown id)', async () => {
    const uid = 'u-unknown-item';
    await seedPlayer(uid);
    await expect(callAs(sellItem, uid, { itemId: 'not-a-real-item' })).rejects.toThrow();
  });

  it('rejects selling a unique item', async () => {
    const uid = 'u-unique';
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'miners-lost-lantern-equipped', quantity: 1 }];
    });
    await expect(callAs(sellItem, uid, { itemId: 'miners-lost-lantern-equipped' })).rejects.toThrow();
  });

  it('rejects selling an item the player does not own', async () => {
    const uid = 'u-not-owned';
    await seedPlayer(uid, (s) => {
      s.inventory = [];
    });
    await expect(callAs(sellItem, uid, { itemId: 'healing-poultice' })).rejects.toThrow();
  });

  it('rejects selling an item that is currently equipped', async () => {
    const uid = 'u-equipped';
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'weathered-walking-staff', quantity: 1 }];
      s.player.equipment.weapon = 'weathered-walking-staff';
    });
    await expect(callAs(sellItem, uid, { itemId: 'weathered-walking-staff' })).rejects.toThrow();
  });

  it('sells at half the shop buy price, rounded down', async () => {
    const uid = 'u-half-price';
    const save = await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'healing-poultice', quantity: 3 }];
    });
    // healing-poultice buys for 15 -> sells for floor(15/2) = 7.
    const result = await callAs(sellItem, uid, { itemId: 'healing-poultice', quantity: 1 });
    expect(result.goldEarned).toBe(7);
    expect(result.gold).toBe(save.player.gold + 7);
    expect(result.soldQuantity).toBe(1);

    const persisted = await readPlayer(uid);
    expect(persisted.inventory.find((i) => i.itemId === 'healing-poultice')?.quantity).toBe(2);
  });

  it('sells at a tier-based fallback price when the item has no shop buy price', async () => {
    const uid = 'u-tier-fallback';
    // ghost-miners-coin is rare tier with no SHOP_PRICES entry -> TIER_FALLBACK_SELL_VALUE.rare (60).
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'ghost-miners-coin', quantity: 1 }];
    });
    const result = await callAs(sellItem, uid, { itemId: 'ghost-miners-coin' });
    expect(result.goldEarned).toBe(60);
  });

  it('selling more than owned clamps to the owned quantity', async () => {
    const uid = 'u-clamp-quantity';
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'healing-poultice', quantity: 2 }];
    });
    const result = await callAs(sellItem, uid, { itemId: 'healing-poultice', quantity: 100 });
    expect(result.soldQuantity).toBe(2);
    expect(result.goldEarned).toBe(14); // 2 * 7

    const persisted = await readPlayer(uid);
    expect(persisted.inventory.some((i) => i.itemId === 'healing-poultice')).toBe(false);
  });

  it('a zero or negative requested quantity still sells at least 1', async () => {
    const uid = 'u-zero-quantity';
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'healing-poultice', quantity: 5 }];
    });
    const result = await callAs(sellItem, uid, { itemId: 'healing-poultice', quantity: 0 });
    expect(result.soldQuantity).toBe(1);
  });

  it('a fractional requested quantity floors before clamping', async () => {
    const uid = 'u-fractional-quantity';
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'healing-poultice', quantity: 5 }];
    });
    const result = await callAs(sellItem, uid, { itemId: 'healing-poultice', quantity: 2.9 });
    expect(result.soldQuantity).toBe(2);
  });

  it('selling the entire stack removes the inventory entry entirely', async () => {
    const uid = 'u-sell-all';
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'healing-poultice', quantity: 3 }];
    });
    const result = await callAs(sellItem, uid, { itemId: 'healing-poultice', quantity: 3 });
    expect(result.soldQuantity).toBe(3);
    expect(await readPlayer(uid)).toMatchObject({ inventory: [] });
  });
});
