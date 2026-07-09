import { describe, expect, it } from 'vitest';
import { grantItem, wouldDuplicateUnique } from './inventoryEngine';
import type { InventoryItem } from '../shared-types';

describe('grantItem', () => {
  it('pushes a new stack for an item not already owned', () => {
    const inventory: InventoryItem[] = [];
    const granted = grantItem(inventory, 'healing-poultice', []);
    expect(granted).toBe(true);
    expect(inventory).toEqual([{ itemId: 'healing-poultice', quantity: 1 }]);
  });

  it('stacks onto an existing entry instead of duplicating it', () => {
    const inventory: InventoryItem[] = [{ itemId: 'healing-poultice', quantity: 2 }];
    grantItem(inventory, 'healing-poultice', [], 3);
    expect(inventory).toEqual([{ itemId: 'healing-poultice', quantity: 5 }]);
  });

  it('refuses to grant a second copy of a unique item, and mutates nothing', () => {
    const inventory: InventoryItem[] = [{ itemId: 'miners-lost-lantern-equipped', quantity: 1 }];
    const granted = grantItem(inventory, 'miners-lost-lantern-equipped', []);
    expect(granted).toBe(false);
    expect(inventory).toEqual([{ itemId: 'miners-lost-lantern-equipped', quantity: 1 }]);
  });

  it('allows the first copy of a unique item', () => {
    const inventory: InventoryItem[] = [];
    const granted = grantItem(inventory, 'wardens-ember-heart', []);
    expect(granted).toBe(true);
    expect(inventory).toEqual([{ itemId: 'wardens-ember-heart', quantity: 1 }]);
  });

  it('records a real ITEMS-table entry into itemsDiscovered, once, on first grant', () => {
    const inventory: InventoryItem[] = [];
    const itemsDiscovered: string[] = [];
    grantItem(inventory, 'healing-poultice', itemsDiscovered);
    grantItem(inventory, 'healing-poultice', itemsDiscovered, 2); // a second grant shouldn't duplicate the entry
    expect(itemsDiscovered).toEqual(['healing-poultice']);
  });

  it('does not record an equipment id into itemsDiscovered (only ITEMS-table entries count)', () => {
    const inventory: InventoryItem[] = [];
    const itemsDiscovered: string[] = [];
    grantItem(inventory, 'miners-lost-lantern-equipped', itemsDiscovered);
    expect(itemsDiscovered).toEqual([]);
  });

  it('does not record itemsDiscovered when the grant is refused (duplicate unique)', () => {
    const inventory: InventoryItem[] = [{ itemId: 'wardens-ember-heart', quantity: 1 }];
    const itemsDiscovered: string[] = [];
    grantItem(inventory, 'wardens-ember-heart', itemsDiscovered);
    expect(itemsDiscovered).toEqual([]);
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
