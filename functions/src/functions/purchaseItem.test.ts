import { describe, expect, it } from 'vitest';
import { callAs, readPlayer, seedPlayer } from '../testUtils/firestoreTestEnv';
import { purchaseItem } from './purchaseItem';

// mara-ash-general-store: ['keepers-lantern', 'antidote', 'eye-drops'] at ash-hallow-mara-shop.
// keepers-lantern (8g) is non-consumable; antidote (12g) is a consumable.
const SHOP_ID = 'mara-ash-general-store';
const SHOP_LOCATION = 'ash-hallow-mara-shop';

// Isolation between tests (and between this file and any other emulator-backed test file running
// in parallel) comes from every test using its own never-reused uid - see firestoreTestEnv.ts's
// resetFirestore() doc comment for why there's deliberately no shared beforeEach wipe here.

describe('purchaseItem', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(purchaseItem.run({ data: { itemId: 'antidote', shopId: SHOP_ID }, auth: undefined })).rejects.toThrow();
  });

  it('rejects an item with no listed price at all', async () => {
    const uid = 'u-no-price';
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = SHOP_LOCATION;
    });
    await expect(callAs(purchaseItem, uid, { itemId: 'not-a-real-item', shopId: SHOP_ID })).rejects.toThrow();
  });

  it("rejects an item that has a price but isn't in this shop's catalog", async () => {
    const uid = 'u-wrong-shop';
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = SHOP_LOCATION;
      s.player.gold = 1000;
    });
    // weathered-walking-staff is priced and real, but sold at the blacksmith, not the general store.
    await expect(callAs(purchaseItem, uid, { itemId: 'weathered-walking-staff', shopId: SHOP_ID })).rejects.toThrow();
  });

  it('rejects a purchase made from the wrong location', async () => {
    const uid = 'u-wrong-location';
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = 'ash-hallow'; // town square, not inside the shop
      s.player.gold = 1000;
    });
    await expect(callAs(purchaseItem, uid, { itemId: 'antidote', shopId: SHOP_ID })).rejects.toThrow();
  });

  it('rejects a purchase with insufficient gold', async () => {
    const uid = 'u-poor';
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = SHOP_LOCATION;
      s.player.gold = 5; // antidote costs 12
    });
    await expect(callAs(purchaseItem, uid, { itemId: 'antidote', shopId: SHOP_ID })).rejects.toThrow();
  });

  it('buys a consumable, deducting gold and adding inventory', async () => {
    const uid = 'u-buy-consumable';
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = SHOP_LOCATION;
      s.player.gold = 100;
    });
    const result = await callAs(purchaseItem, uid, { itemId: 'antidote', shopId: SHOP_ID });
    expect(result.gold).toBe(88); // 100 - 12
    expect(result.inventory.find((i) => i.itemId === 'antidote')?.quantity).toBe(1);

    const persisted = await readPlayer(uid);
    expect(persisted.player.gold).toBe(88);
  });

  it('buying the same consumable twice stacks quantity instead of erroring', async () => {
    const uid = 'u-buy-twice';
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = SHOP_LOCATION;
      s.player.gold = 100;
    });
    await callAs(purchaseItem, uid, { itemId: 'antidote', shopId: SHOP_ID });
    const result = await callAs(purchaseItem, uid, { itemId: 'antidote', shopId: SHOP_ID });
    expect(result.gold).toBe(76); // 100 - 12 - 12
    expect(result.inventory.find((i) => i.itemId === 'antidote')?.quantity).toBe(2);
  });

  it('buys a non-consumable once, deducting gold and adding inventory', async () => {
    // A different shop/item than keepers-lantern below - fresh characters already start owning
    // one keepers-lantern, so that item can only ever exercise the "already own one" path.
    const uid = 'u-buy-nonconsumable';
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = 'ash-hallow-blacksmith';
      s.player.gold = 100;
    });
    const result = await callAs(purchaseItem, uid, { itemId: 'weathered-walking-staff', shopId: 'ash-hallow-blacksmith-forge' });
    expect(result.inventory.find((i) => i.itemId === 'weathered-walking-staff')?.quantity).toBe(1);
    expect(result.gold).toBeLessThan(100);
  });

  it('rejects buying a second copy of a non-consumable already owned', async () => {
    const uid = 'u-duplicate-nonconsumable';
    await seedPlayer(uid, (s) => {
      s.player.currentLocationId = SHOP_LOCATION;
      s.player.gold = 100;
      // Fresh characters already start with one keepers-lantern in inventory.
    });
    await expect(callAs(purchaseItem, uid, { itemId: 'keepers-lantern', shopId: SHOP_ID })).rejects.toThrow();
  });

  it('a purchase that fails validation leaves gold and inventory untouched', async () => {
    const uid = 'u-no-partial-effect';
    const save = await seedPlayer(uid, (s) => {
      s.player.currentLocationId = SHOP_LOCATION;
      s.player.gold = 5;
    });
    await expect(callAs(purchaseItem, uid, { itemId: 'antidote', shopId: SHOP_ID })).rejects.toThrow();
    const persisted = await readPlayer(uid);
    expect(persisted.player.gold).toBe(save.player.gold);
    expect(persisted.inventory).toEqual(save.inventory);
  });
});
