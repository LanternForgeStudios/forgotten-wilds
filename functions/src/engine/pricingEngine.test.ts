import { describe, expect, it } from 'vitest';
import { sellPriceFor } from './pricingEngine';

describe('sellPriceFor', () => {
  it('halves the shop buy price for a purchasable item', () => {
    // healing-poultice buys for 15g.
    expect(sellPriceFor('healing-poultice')).toBe(7);
  });

  it('floors and never returns less than 1g', () => {
    // keepers-lantern buys for 8g -> half is 4.
    expect(sellPriceFor('keepers-lantern')).toBe(4);
  });

  it('returns undefined for a unique item', () => {
    expect(sellPriceFor('miners-lost-lantern')).toBeUndefined();
    expect(sellPriceFor('wardens-ember-heart')).toBeUndefined();
    expect(sellPriceFor('miners-lost-lantern-equipped')).toBeUndefined();
  });

  it('returns undefined for an unknown item id', () => {
    expect(sellPriceFor('not-a-real-item')).toBeUndefined();
  });

  it('falls back to a flat tier-based value for non-purchasable, non-unique gear', () => {
    // keepers-lantern-staff (uncommon weapon) isn't in SHOP_PRICES - chest/quest reward only.
    expect(sellPriceFor('keepers-lantern-staff')).toBe(30);
    // moth-dust (common key item) also isn't purchasable.
    expect(sellPriceFor('moth-dust')).toBe(15);
  });
});
