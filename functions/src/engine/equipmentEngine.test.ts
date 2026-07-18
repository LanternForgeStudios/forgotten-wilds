import { describe, expect, it } from 'vitest';
import {
  adjustStatsForBonuses,
  backfillPlayerEquipment,
  computeAilmentResistances,
  resolveWeaponAttackAilment,
  setLanternOilCapacity,
} from './equipmentEngine';
import type { PlayerEquipment, PlayerSave, Stats } from '../shared-types';

function stats(overrides: Partial<Stats> = {}): Stats {
  return { hp: 60, maxHp: 60, spirit: 30, maxSpirit: 30, attack: 8, defense: 5, speed: 6, ...overrides };
}

describe('adjustStatsForBonuses', () => {
  it('applies positive bonuses to the relevant stats', () => {
    const s = stats();
    adjustStatsForBonuses(s, { attack: 8, speed: 1 }, 1);
    expect(s.attack).toBe(16);
    expect(s.speed).toBe(7);
  });

  it('removes bonuses symmetrically when unequipping', () => {
    const s = stats();
    adjustStatsForBonuses(s, { maxSpirit: 5 }, 1);
    expect(s.maxSpirit).toBe(35);
    adjustStatsForBonuses(s, { maxSpirit: 5 }, -1);
    expect(s.maxSpirit).toBe(30);
  });

  it('clamps current hp/spirit down when maxHp/maxSpirit shrinks below current value', () => {
    const s = stats({ hp: 60, maxHp: 60, spirit: 30, maxSpirit: 30 });
    adjustStatsForBonuses(s, { maxHp: 10, maxSpirit: 5 }, 1);
    expect(s.maxHp).toBe(70);
    expect(s.hp).toBe(60); // untouched, still below the new max
    adjustStatsForBonuses(s, { maxHp: 10, maxSpirit: 5 }, -1);
    expect(s.maxHp).toBe(60);
    expect(s.hp).toBe(60); // exactly at the new max, not clamped below it
  });

  it('never drops a stat below its floor (0, or 1 for maxHp)', () => {
    const s = stats({ attack: 2, defense: 1, maxHp: 5 });
    adjustStatsForBonuses(s, { attack: 10, defense: 10, maxHp: 10 }, -1);
    expect(s.attack).toBe(0);
    expect(s.defense).toBe(0);
    expect(s.maxHp).toBe(1);
  });
});

describe('backfillPlayerEquipment', () => {
  it('fills in a fully-null equipment block on a save written before the equipment system existed', () => {
    const save = { player: {} } as unknown as PlayerSave;
    backfillPlayerEquipment(save);
    expect(save.player.equipment).toEqual({
      weapon: null,
      armor: null,
      boots: null,
      gloves: null,
      charm: null,
      lantern: null,
      spiritTotem: null,
    });
  });

  it('leaves an existing equipment block untouched', () => {
    const equipment: PlayerEquipment = {
      weapon: 'weathered-walking-staff',
      armor: null,
      boots: null,
      gloves: null,
      charm: null,
      lantern: null,
      spiritTotem: null,
    };
    const save = { player: { equipment } } as unknown as PlayerSave;
    backfillPlayerEquipment(save);
    expect(save.player.equipment).toBe(equipment);
  });
});

describe('resolveWeaponAttackAilment', () => {
  it('returns undefined when no weapon is equipped', () => {
    expect(resolveWeaponAttackAilment(null)).toBeUndefined();
    expect(resolveWeaponAttackAilment(undefined)).toBeUndefined();
  });

  it('returns undefined for a real weapon that sets no attackAilment (true of every authored weapon today)', () => {
    expect(resolveWeaponAttackAilment('weathered-walking-staff')).toBeUndefined();
  });

  it('returns undefined for an unknown weapon id rather than throwing', () => {
    expect(resolveWeaponAttackAilment('not-a-real-item')).toBeUndefined();
  });
});

describe('computeAilmentResistances', () => {
  const emptyEquipment: PlayerEquipment = {
    weapon: null,
    armor: null,
    boots: null,
    gloves: null,
    charm: null,
    lantern: null,
    spiritTotem: null,
  };

  it('returns [] when nothing is equipped', () => {
    expect(computeAilmentResistances(emptyEquipment)).toEqual([]);
  });

  it('returns [] for real equipped items, since none set ailmentResistance today', () => {
    expect(
      computeAilmentResistances({ ...emptyEquipment, weapon: 'weathered-walking-staff', lantern: 'keepers-lantern' }),
    ).toEqual([]);
  });
});

describe('setLanternOilCapacity', () => {
  it('sets maxLanternOil and leaves current oil untouched when it still fits', () => {
    const s = stats({ lanternOil: 3, maxLanternOil: 5 });
    setLanternOilCapacity(s, 10);
    expect(s.maxLanternOil).toBe(10);
    expect(s.lanternOil).toBe(3);
  });

  it('clamps current oil down when the new capacity is lower (swapping lanterns is not a free refill)', () => {
    const s = stats({ lanternOil: 8, maxLanternOil: 10 });
    setLanternOilCapacity(s, 4);
    expect(s.maxLanternOil).toBe(4);
    expect(s.lanternOil).toBe(4);
  });

  it('floors capacity at 0 (unequipping a lantern) rather than going negative', () => {
    const s = stats({ lanternOil: 5, maxLanternOil: 10 });
    setLanternOilCapacity(s, -3);
    expect(s.maxLanternOil).toBe(0);
    expect(s.lanternOil).toBe(0);
  });
});
