import { describe, expect, it } from 'vitest';
import { effectiveLevelForWave, isMilestoneWave, milestoneChestTier, rollWaveEnemies } from './endlessBattleEngine';

describe('effectiveLevelForWave', () => {
  it('starts at the party average level on wave 1', () => {
    expect(effectiveLevelForWave(1, 20)).toBe(20);
  });

  it('escalates with each wave', () => {
    const wave1 = effectiveLevelForWave(1, 10);
    const wave5 = effectiveLevelForWave(5, 10);
    const wave10 = effectiveLevelForWave(10, 10);
    expect(wave5).toBeGreaterThan(wave1);
    expect(wave10).toBeGreaterThan(wave5);
  });

  it('never exceeds the 100 level cap even at an absurd wave number', () => {
    expect(effectiveLevelForWave(1000, 100)).toBe(100);
  });

  it('never drops below 1', () => {
    expect(effectiveLevelForWave(1, 0)).toBeGreaterThanOrEqual(1);
  });
});

describe('isMilestoneWave', () => {
  it('is true only on multiples of 5', () => {
    expect(isMilestoneWave(5)).toBe(true);
    expect(isMilestoneWave(10)).toBe(true);
    expect(isMilestoneWave(4)).toBe(false);
    expect(isMilestoneWave(0)).toBe(false);
  });
});

describe('milestoneChestTier', () => {
  it('is standard at wave 5 and elite from wave 10 onward', () => {
    expect(milestoneChestTier(5)).toBe('standard');
    expect(milestoneChestTier(10)).toBe('elite');
    expect(milestoneChestTier(20)).toBe('elite');
  });
});

describe('rollWaveEnemies', () => {
  it('rolls a real enemy group scaled to the wave, for a known location', () => {
    for (let i = 0; i < 10; i++) {
      const enemies = rollWaveEnemies('ironwood-trail', 3, 10);
      expect(enemies.length).toBeGreaterThanOrEqual(1);
      for (const e of enemies) {
        expect(e.hp).toBeGreaterThan(0);
        expect(e.hp).toBe(e.maxHp);
        expect(e.level).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('later waves roll tougher enemies on average than wave 1', () => {
    let wave1TotalHp = 0;
    let wave10TotalHp = 0;
    const trials = 30;
    for (let i = 0; i < trials; i++) {
      wave1TotalHp += rollWaveEnemies('ironwood-trail', 1, 5).reduce((sum, e) => sum + e.maxHp, 0);
      wave10TotalHp += rollWaveEnemies('ironwood-trail', 10, 5).reduce((sum, e) => sum + e.maxHp, 0);
    }
    expect(wave10TotalHp / trials).toBeGreaterThan(wave1TotalHp / trials);
  });
});
