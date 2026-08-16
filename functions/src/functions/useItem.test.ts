import { getFirestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { callAs, readPlayer, seedPlayer } from '../testUtils/firestoreTestEnv';
import { useItem } from './useItem';
import type { CombatSession } from '../shared-types';

// Isolation between tests (and any other emulator-backed test file running in parallel) comes
// from every test using its own never-reused uid - see firestoreTestEnv.ts's resetFirestore()
// doc comment for why there's deliberately no shared beforeEach wipe here.

async function seedCombatSession(uid: string, playerAilments: CombatSession['playerAilments']): Promise<void> {
  const now = Date.now();
  const session: CombatSession = {
    sessionId: uid,
    uid,
    locationId: 'ash-hallow',
    enemies: [],
    round: 1,
    status: 'active',
    startedAt: now,
    expiresAt: now + 60_000,
    playerAilments,
  };
  await getFirestore().collection('combatSessions').doc(uid).set(session);
}

describe('useItem', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(useItem.run({ data: { itemId: 'healing-poultice' }, auth: undefined })).rejects.toThrow();
  });

  it('rejects an item with no usable-outside-combat effect at all', async () => {
    const uid = 'u-no-effect';
    await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'moth-dust', quantity: 1 }); // a material, no `effect`
    });
    await expect(callAs(useItem, uid, { itemId: 'moth-dust' })).rejects.toThrow();
  });

  it('rejects using an item the player does not own', async () => {
    const uid = 'u-not-owned';
    await seedPlayer(uid);
    await expect(callAs(useItem, uid, { itemId: 'healing-poultice' })).rejects.toThrow();
  });

  it('heals HP by the item\'s percent, capped at maxHp, and consumes one', async () => {
    const uid = 'u-heal-hp';
    await seedPlayer(uid, (s) => {
      s.player.stats.hp = 10;
      s.player.stats.maxHp = 60;
      // Fresh characters already start with 2 healing-poultices - overwrite rather than push, so
      // there's exactly one inventory entry to assert against instead of two.
      s.inventory = [{ itemId: 'healing-poultice', quantity: 2 }];
    });
    const result = await callAs(useItem, uid, { itemId: 'healing-poultice' });
    expect(result.stats.hp).toBe(10 + Math.round(60 * 0.3)); // healHpPercent: 0.3
    expect(result.inventory.find((i) => i.itemId === 'healing-poultice')?.quantity).toBe(1);

    const persisted = await readPlayer(uid);
    expect(persisted.player.stats.hp).toBe(result.stats.hp);
  });

  it('the last copy of an item is fully removed from inventory, not left at quantity 0', async () => {
    const uid = 'u-last-copy';
    await seedPlayer(uid, (s) => {
      s.player.stats.hp = 10;
      // Overwrite, not push - fresh characters already start owning healing-poultice.
      s.inventory = [{ itemId: 'healing-poultice', quantity: 1 }];
    });
    const result = await callAs(useItem, uid, { itemId: 'healing-poultice' });
    expect(result.inventory.some((i) => i.itemId === 'healing-poultice')).toBe(false);
  });

  it('rejects a heal item when already at full HP (no effect right now)', async () => {
    const uid = 'u-already-full';
    const save = await seedPlayer(uid, (s) => {
      s.player.stats.hp = s.player.stats.maxHp;
      s.inventory = [{ itemId: 'healing-poultice', quantity: 1 }];
    });
    await expect(callAs(useItem, uid, { itemId: 'healing-poultice' })).rejects.toThrow();
    // Rolled back - still owns the item.
    const persisted = await readPlayer(uid);
    expect(persisted.inventory.find((i) => i.itemId === 'healing-poultice')?.quantity).toBe(1);
    expect(persisted.player.stats.hp).toBe(save.player.stats.maxHp);
  });

  it('healing never overshoots maxHp', async () => {
    const uid = 'u-clamp-hp';
    await seedPlayer(uid, (s) => {
      s.player.stats.hp = s.player.stats.maxHp - 1; // just under full
      s.inventory = [{ itemId: 'healing-poultice', quantity: 1 }]; // would heal 18 (30% of 60)
    });
    const result = await callAs(useItem, uid, { itemId: 'healing-poultice' });
    expect(result.stats.hp).toBe(result.stats.maxHp);
  });

  it('restores Spirit by the item\'s percent, capped at maxSpirit', async () => {
    const uid = 'u-heal-spirit';
    await seedPlayer(uid, (s) => {
      s.player.stats.spirit = 0;
      s.player.stats.maxSpirit = 30;
      s.inventory.push({ itemId: 'spirit-draught', quantity: 1 });
    });
    const result = await callAs(useItem, uid, { itemId: 'spirit-draught' });
    expect(result.stats.spirit).toBe(Math.round(30 * 0.3));
  });

  it('outside combat, an ailment cure item has no effect to apply and is rejected', async () => {
    const uid = 'u-cure-no-session';
    await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'antidote', quantity: 1 });
    });
    // No combatSessions/{uid} doc at all - itemWouldHaveEffect sees an empty playerAilments list.
    await expect(callAs(useItem, uid, { itemId: 'antidote' })).rejects.toThrow();
  });

  it('cures the matching ailment when a live combat session has it active', async () => {
    const uid = 'u-cure-active';
    await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'antidote', quantity: 1 });
    });
    await seedCombatSession(uid, [{ ailmentId: 'poison', turnsRemaining: 3 }, { ailmentId: 'burn' }]);

    const result = await callAs(useItem, uid, { itemId: 'antidote' });
    expect(result.playerAilments).toEqual([{ ailmentId: 'burn' }]);

    const sessionSnap = await getFirestore().collection('combatSessions').doc(uid).get();
    expect(sessionSnap.data()?.playerAilments).toEqual([{ ailmentId: 'burn' }]);
  });

  it('rejects an ailment cure when the session is active but does not have that ailment', async () => {
    const uid = 'u-cure-mismatch';
    await seedPlayer(uid, (s) => {
      s.inventory.push({ itemId: 'antidote', quantity: 1 });
    });
    await seedCombatSession(uid, [{ ailmentId: 'burn' }]); // no poison to cure

    await expect(callAs(useItem, uid, { itemId: 'antidote' })).rejects.toThrow();
  });
});
