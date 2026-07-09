import { describe, expect, it } from 'vitest';
import { grantItem, wouldDuplicateUnique } from './inventoryEngine';
import type { InventoryItem, PlayerSave } from '../shared-types';

/** grantItem only ever touches save.inventory and save.journal.itemsDiscovered - a minimal
 *  fixture with just those two is enough to exercise it without building a full realistic save. */
function buildSave(inventory: InventoryItem[] = [], itemsDiscovered: string[] = []): PlayerSave {
  return {
    inventory,
    journal: { creaturesDiscovered: [], locationsVisited: [], loreUnlocked: [], bossesDefeated: [], itemsDiscovered },
  } as PlayerSave;
}

describe('grantItem', () => {
  it('pushes a new stack for an item not already owned', () => {
    const save = buildSave();
    const granted = grantItem(save, 'healing-poultice');
    expect(granted).toBe(true);
    expect(save.inventory).toEqual([{ itemId: 'healing-poultice', quantity: 1 }]);
  });

  it('stacks onto an existing entry instead of duplicating it', () => {
    const save = buildSave([{ itemId: 'healing-poultice', quantity: 2 }]);
    grantItem(save, 'healing-poultice', 3);
    expect(save.inventory).toEqual([{ itemId: 'healing-poultice', quantity: 5 }]);
  });

  it('refuses to grant a second copy of a unique item, and mutates nothing', () => {
    const save = buildSave([{ itemId: 'miners-lost-lantern-equipped', quantity: 1 }]);
    const granted = grantItem(save, 'miners-lost-lantern-equipped');
    expect(granted).toBe(false);
    expect(save.inventory).toEqual([{ itemId: 'miners-lost-lantern-equipped', quantity: 1 }]);
  });

  it('allows the first copy of a unique item', () => {
    const save = buildSave();
    const granted = grantItem(save, 'wardens-ember-heart');
    expect(granted).toBe(true);
    expect(save.inventory).toEqual([{ itemId: 'wardens-ember-heart', quantity: 1 }]);
  });

  it('records a real ITEMS-table entry into itemsDiscovered, once, on first grant', () => {
    const save = buildSave();
    grantItem(save, 'healing-poultice');
    grantItem(save, 'healing-poultice', 2); // a second grant shouldn't duplicate the entry
    expect(save.journal.itemsDiscovered).toEqual(['healing-poultice']);
  });

  it('does not record an equipment id into itemsDiscovered (only ITEMS-table entries count)', () => {
    const save = buildSave();
    grantItem(save, 'miners-lost-lantern-equipped');
    expect(save.journal.itemsDiscovered).toEqual([]);
  });

  it('does not record itemsDiscovered when the grant is refused (duplicate unique)', () => {
    const save = buildSave([{ itemId: 'wardens-ember-heart', quantity: 1 }]);
    grantItem(save, 'wardens-ember-heart');
    expect(save.journal.itemsDiscovered).toEqual([]);
  });

  it('backfills a missing journal.itemsDiscovered (an existing save read before this field existed) instead of throwing', () => {
    const save = buildSave();
    // Simulates a real Firestore document from before itemsDiscovered was introduced.
    delete (save.journal as { itemsDiscovered?: string[] }).itemsDiscovered;
    expect(() => grantItem(save, 'healing-poultice')).not.toThrow();
    expect(save.journal.itemsDiscovered).toEqual(['healing-poultice']);
  });
});

describe('wouldDuplicateUnique', () => {
  it('is false for a non-unique item regardless of how many are owned', () => {
    const inventory: InventoryItem[] = [{ itemId: 'healing-poultice', quantity: 99 }];
    expect(wouldDuplicateUnique(inventory, 'healing-poultice')).toBe(false);
  });

  it('is true only once a unique item is already owned', () => {
    expect(wouldDuplicateUnique([], 'miners-lost-lantern-equipped')).toBe(false);
    expect(
      wouldDuplicateUnique([{ itemId: 'miners-lost-lantern-equipped', quantity: 1 }], 'miners-lost-lantern-equipped'),
    ).toBe(true);
  });

  it('checks unique key items (ITEMS), not just unique equipment (EQUIPMENT)', () => {
    // wardens-ember-heart is defined in ITEMS, not EQUIPMENT - confirms the check covers both tables.
    expect(wouldDuplicateUnique([{ itemId: 'wardens-ember-heart', quantity: 1 }], 'wardens-ember-heart')).toBe(true);
  });
});
