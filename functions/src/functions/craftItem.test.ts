import { describe, expect, it } from 'vitest';
import { callAs, readPlayer, seedPlayer } from '../testUtils/firestoreTestEnv';
import { craftItem } from './craftItem';

// Isolation between tests (and any other emulator-backed test file running in parallel) comes
// from every test using its own never-reused uid - see firestoreTestEnv.ts's resetFirestore()
// doc comment for why there's deliberately no shared beforeEach wipe here.

describe('craftItem', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(craftItem.run({ data: { recipeId: 'healing-poultice' }, auth: undefined })).rejects.toThrow();
  });

  it('rejects an unknown recipeId', async () => {
    const uid = 'u-unknown-recipe';
    await seedPlayer(uid);
    await expect(callAs(craftItem, uid, { recipeId: 'not-a-real-recipe' })).rejects.toThrow();
  });

  it('rejects crafting with no materials at all', async () => {
    const uid = 'u-no-materials';
    await seedPlayer(uid, (s) => {
      s.inventory = [];
    });
    await expect(callAs(craftItem, uid, { recipeId: 'healing-poultice' })).rejects.toThrow();
  });

  it('rejects crafting with fewer materials than the recipe requires', async () => {
    const uid = 'u-not-enough';
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'moth-dust', quantity: 1 }]; // healing-poultice needs 2
    });
    await expect(callAs(craftItem, uid, { recipeId: 'healing-poultice' })).rejects.toThrow();

    // Rolled back - the one moth-dust the player did have is untouched.
    const persisted = await readPlayer(uid);
    expect(persisted.inventory.find((i) => i.itemId === 'moth-dust')?.quantity).toBe(1);
  });

  it('crafts a single-material recipe, consuming materials and granting the output', async () => {
    const uid = 'u-basic-craft';
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'moth-dust', quantity: 2 }];
    });
    const result = await callAs(craftItem, uid, { recipeId: 'healing-poultice' });
    expect(result.inventory.some((i) => i.itemId === 'moth-dust')).toBe(false); // fully consumed
    expect(result.inventory.find((i) => i.itemId === 'healing-poultice')?.quantity).toBe(1);
  });

  it('crafting when already owning some of the output stacks the quantity', async () => {
    const uid = 'u-stack-output';
    await seedPlayer(uid, (s) => {
      // Fresh characters already own 2 healing-poultices.
      s.inventory = [
        { itemId: 'healing-poultice', quantity: 2 },
        { itemId: 'moth-dust', quantity: 2 },
      ];
    });
    const result = await callAs(craftItem, uid, { recipeId: 'healing-poultice' });
    expect(result.inventory.find((i) => i.itemId === 'healing-poultice')?.quantity).toBe(3);
  });

  it('consumes across alternate materials in the same slot, primary material first', async () => {
    const uid = 'u-alternates';
    // antidote needs 2x from [withered-bramble, bog-ash, withered-echo-moss] (primary first).
    await seedPlayer(uid, (s) => {
      s.inventory = [
        { itemId: 'withered-bramble', quantity: 1 },
        { itemId: 'bog-ash', quantity: 5 },
      ];
    });
    const result = await callAs(craftItem, uid, { recipeId: 'antidote' });
    // 1 needed from the primary (fully consumed, entry removed), 1 more from the alternate.
    expect(result.inventory.some((i) => i.itemId === 'withered-bramble')).toBe(false);
    expect(result.inventory.find((i) => i.itemId === 'bog-ash')?.quantity).toBe(4);
    expect(result.inventory.find((i) => i.itemId === 'antidote')?.quantity).toBe(1);
  });

  it('sums alternates toward the requirement - not enough in any single one alone is still enough combined', async () => {
    const uid = 'u-sum-alternates';
    await seedPlayer(uid, (s) => {
      s.inventory = [
        { itemId: 'withered-bramble', quantity: 1 },
        { itemId: 'bog-ash', quantity: 1 },
      ]; // 1 + 1 = 2, exactly enough
    });
    const result = await callAs(craftItem, uid, { recipeId: 'antidote' });
    expect(result.inventory.find((i) => i.itemId === 'antidote')?.quantity).toBe(1);
  });

  it('crafts a multi-slot recipe, consuming every slot correctly', async () => {
    const uid = 'u-multi-slot';
    // greater-healing-poultice: 3x [moth-dust] + 1x [ember-shard, ancient-serpent-scale].
    await seedPlayer(uid, (s) => {
      s.inventory = [
        { itemId: 'moth-dust', quantity: 3 },
        { itemId: 'ember-shard', quantity: 1 },
      ];
    });
    const result = await callAs(craftItem, uid, { recipeId: 'greater-healing-poultice' });
    expect(result.inventory.some((i) => i.itemId === 'moth-dust')).toBe(false);
    expect(result.inventory.some((i) => i.itemId === 'ember-shard')).toBe(false);
    expect(result.inventory.find((i) => i.itemId === 'greater-healing-poultice')?.quantity).toBe(1);
  });

  it('rejects a multi-slot recipe missing just one of its slots', async () => {
    const uid = 'u-multi-slot-missing-one';
    await seedPlayer(uid, (s) => {
      s.inventory = [{ itemId: 'moth-dust', quantity: 3 }]; // has the moth-dust, no ember-shard
    });
    await expect(callAs(craftItem, uid, { recipeId: 'greater-healing-poultice' })).rejects.toThrow();

    const persisted = await readPlayer(uid);
    expect(persisted.inventory.find((i) => i.itemId === 'moth-dust')?.quantity).toBe(3);
  });

  it('leaves a partially-consumed material slot at the correct remaining quantity', async () => {
    const uid = 'u-partial-remaining';
    await seedPlayer(uid, (s) => {
      s.inventory = [
        { itemId: 'moth-dust', quantity: 10 }, // needs only 3
        { itemId: 'ember-shard', quantity: 1 },
      ];
    });
    const result = await callAs(craftItem, uid, { recipeId: 'greater-healing-poultice' });
    expect(result.inventory.find((i) => i.itemId === 'moth-dust')?.quantity).toBe(7);
  });
});
