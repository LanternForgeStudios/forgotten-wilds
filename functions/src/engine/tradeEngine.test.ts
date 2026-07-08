import { describe, expect, it } from 'vitest';
import {
  escrowOffer,
  mergeOfferInto,
  mergeTradeItemRequests,
  releaseOffer,
  validateTradeOfferItems,
} from './tradeEngine';
import type { InventoryItem, PlayerEquipment, PlayerSave, TradeOfferSide } from '../shared-types';

const NO_EQUIPMENT: PlayerEquipment = {
  weapon: null,
  armor: null,
  boots: null,
  gloves: null,
  charm: null,
  lantern: null,
  spiritTotem: null,
};

function makeSave(inventory: InventoryItem[], gold: number, equipment: PlayerEquipment = NO_EQUIPMENT): PlayerSave {
  return {
    displayName: 'Tester',
    createdAt: 0,
    lastLoginAt: 0,
    player: {
      uid: 'u1',
      name: 'Tester',
      level: 1,
      xp: 0,
      gold,
      spiritEssence: 0,
      festivalTokens: 0,
      premiumCurrency: 0,
      stats: { hp: 60, maxHp: 60, spirit: 30, maxSpirit: 30, attack: 8, defense: 5, speed: 6, lanternOil: 20, maxLanternOil: 20, stamina: 0, maxStamina: 0 },
      spiritRank: 'Unawakened',
      explorerRank: 'Newcomer',
      regionalReputation: 0,
      equipment,
      currentLocationId: 'ash-hallow',
    },
    inventory,
    quests: {},
    journal: { creaturesDiscovered: [], locationsVisited: [], loreUnlocked: [], bossesDefeated: [] },
    openedChests: [],
    seenNpcDialogueVariant: {},
    lastReviewedSocialAt: 0,
    updatedAt: 0,
  };
}

describe('mergeTradeItemRequests', () => {
  it('sums quantities for a repeated itemId into a single entry', () => {
    const merged = mergeTradeItemRequests([
      { itemId: 'healing-poultice', quantity: 2 },
      { itemId: 'healing-poultice', quantity: 3 },
    ]);
    expect(merged).toEqual([{ itemId: 'healing-poultice', quantity: 5 }]);
  });

  it('leaves distinct itemIds as separate entries', () => {
    const merged = mergeTradeItemRequests([
      { itemId: 'healing-poultice', quantity: 1 },
      { itemId: 'lantern-oil', quantity: 2 },
    ]);
    expect(merged).toEqual([
      { itemId: 'healing-poultice', quantity: 1 },
      { itemId: 'lantern-oil', quantity: 2 },
    ]);
  });
});

describe('validateTradeOfferItems', () => {
  it('accepts an offer the player can fully cover', () => {
    const inventory: InventoryItem[] = [{ itemId: 'healing-poultice', quantity: 3 }];
    const result = validateTradeOfferItems([{ itemId: 'healing-poultice', quantity: 2 }], inventory, NO_EQUIPMENT);
    expect(result.ok).toBe(true);
  });

  it('rejects insufficient quantity', () => {
    const inventory: InventoryItem[] = [{ itemId: 'healing-poultice', quantity: 1 }];
    const result = validateTradeOfferItems([{ itemId: 'healing-poultice', quantity: 2 }], inventory, NO_EQUIPMENT);
    expect(result.ok).toBe(false);
  });

  it('rejects a unique item outright, even if owned', () => {
    const inventory: InventoryItem[] = [{ itemId: 'wardens-ember-heart', quantity: 1 }];
    const result = validateTradeOfferItems([{ itemId: 'wardens-ember-heart', quantity: 1 }], inventory, NO_EQUIPMENT);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/unique/i);
  });

  it('rejects a currently-equipped item', () => {
    const inventory: InventoryItem[] = [{ itemId: 'weathered-walking-staff', quantity: 1 }];
    const equipment: PlayerEquipment = { ...NO_EQUIPMENT, weapon: 'weathered-walking-staff' };
    const result = validateTradeOfferItems([{ itemId: 'weathered-walking-staff', quantity: 1 }], inventory, equipment);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/unequip/i);
  });

  it('rejects a non-integer or non-positive quantity', () => {
    const inventory: InventoryItem[] = [{ itemId: 'healing-poultice', quantity: 5 }];
    expect(validateTradeOfferItems([{ itemId: 'healing-poultice', quantity: 0 }], inventory, NO_EQUIPMENT).ok).toBe(false);
    expect(validateTradeOfferItems([{ itemId: 'healing-poultice', quantity: 1.5 }], inventory, NO_EQUIPMENT).ok).toBe(false);
  });
});

describe('escrowOffer / releaseOffer round-trip', () => {
  it('removes exactly the offered items/gold, and releaseOffer restores them exactly', () => {
    const save = makeSave([{ itemId: 'healing-poultice', quantity: 5 }], 100);
    const offer: TradeOfferSide = { items: [{ itemId: 'healing-poultice', quantity: 2 }], gold: 30 };

    escrowOffer(save, offer);
    expect(save.inventory).toEqual([{ itemId: 'healing-poultice', quantity: 3 }]);
    expect(save.player.gold).toBe(70);

    releaseOffer(save, offer);
    expect(save.inventory).toEqual([{ itemId: 'healing-poultice', quantity: 5 }]);
    expect(save.player.gold).toBe(100);
  });

  it('escrowOffer removes a fully-offered stack from inventory entirely', () => {
    const save = makeSave([{ itemId: 'healing-poultice', quantity: 2 }], 0);
    escrowOffer(save, { items: [{ itemId: 'healing-poultice', quantity: 2 }], gold: 0 });
    expect(save.inventory).toEqual([]);
  });
});

describe('mergeOfferInto', () => {
  it('grants the offer into a save that does not yet own the item', () => {
    const save = makeSave([], 10);
    mergeOfferInto(save, { items: [{ itemId: 'healing-poultice', quantity: 4 }], gold: 25 });
    expect(save.inventory).toEqual([{ itemId: 'healing-poultice', quantity: 4 }]);
    expect(save.player.gold).toBe(35);
  });

  it('stacks onto an existing entry rather than duplicating it', () => {
    const save = makeSave([{ itemId: 'healing-poultice', quantity: 1 }], 0);
    mergeOfferInto(save, { items: [{ itemId: 'healing-poultice', quantity: 2 }], gold: 0 });
    expect(save.inventory).toEqual([{ itemId: 'healing-poultice', quantity: 3 }]);
  });
});

describe('full trade round-trip (escrow both sides, then merge into the other account)', () => {
  it('swaps each side\'s escrowed offer into the other account\'s save', () => {
    const initiatorSave = makeSave([{ itemId: 'healing-poultice', quantity: 5 }], 100);
    const recipientSave = makeSave([{ itemId: 'lantern-oil', quantity: 3 }], 50);

    const initiatorOffer: TradeOfferSide = { items: [{ itemId: 'healing-poultice', quantity: 2 }], gold: 20 };
    const recipientOffer: TradeOfferSide = { items: [{ itemId: 'lantern-oil', quantity: 1 }], gold: 5 };

    escrowOffer(initiatorSave, initiatorOffer);
    escrowOffer(recipientSave, recipientOffer);

    mergeOfferInto(initiatorSave, recipientOffer);
    mergeOfferInto(recipientSave, initiatorOffer);

    expect(initiatorSave.inventory).toEqual([
      { itemId: 'healing-poultice', quantity: 3 },
      { itemId: 'lantern-oil', quantity: 1 },
    ]);
    expect(initiatorSave.player.gold).toBe(85);

    expect(recipientSave.inventory).toEqual([
      { itemId: 'lantern-oil', quantity: 2 },
      { itemId: 'healing-poultice', quantity: 2 },
    ]);
    expect(recipientSave.player.gold).toBe(65);
  });
});
