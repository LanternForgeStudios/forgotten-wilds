import { describe, expect, it } from 'vitest';
import { adjustStatsForBonuses } from './equipmentEngine';
import type { Stats } from '../shared-types';

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
