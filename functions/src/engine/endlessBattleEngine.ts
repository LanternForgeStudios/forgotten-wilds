// Pure wave/reward math for Endless Battle (functions/src/functions/endlessBattle.ts) - kept
// separate from partyCombatEngine.ts (which only resolves one round at a time and has no notion
// of "waves" at all) so both stay independently testable.

import { rollEncounterGroup, rollEnemyLevel, scaledEnemyStats } from './combatEngine';
import type { ChestTier } from './dailyChestEngine';
import type { PartyBattleEnemyState } from '../shared-types';

/** Escalates a wave's enemy difficulty from the party's own average level, rather than the fixed
 *  level a solo encounter rolls at - waves 1+ get progressively harder relative to *this party*,
 *  which is the whole point of "endless" (per the design doc: "difficulty continues increasing
 *  until the party can no longer survive"). +3 effective levels per wave was chosen by hand (no
 *  real playtesting data exists yet for this brand-new mode) to roughly double enemy level by
 *  wave 15-20 - expect this to need real tuning once Endless Battle actually gets played.
 *  Capped at 100 (the level cap referenced elsewhere) purely so the number stays sane at absurdly
 *  high waves; rollEnemyLevel's own MAX_ENEMY_LEVEL clamp (50) is what actually bounds enemy
 *  stats. */
export function effectiveLevelForWave(wave: number, partyAverageLevel: number): number {
  return Math.min(100, Math.max(1, Math.round(partyAverageLevel + (wave - 1) * 3)));
}

/** Rolls one wave's enemy roster, reusing the exact same group-size/level-scaling machinery a
 *  solo encounter uses (rollEncounterGroup/rollEnemyLevel/scaledEnemyStats) against an escalating
 *  "virtual" player level instead of anyone's real one - see effectiveLevelForWave. Throws the
 *  same way rollEncounterGroup does if `locationId` has no encounter table (see the caller for
 *  how that's surfaced). */
export function rollWaveEnemies(locationId: string, wave: number, partyAverageLevel: number): PartyBattleEnemyState[] {
  const effectiveLevel = effectiveLevelForWave(wave, partyAverageLevel);
  const enemies = rollEncounterGroup(locationId, effectiveLevel);
  return enemies.map((enemy) => {
    const level = rollEnemyLevel(effectiveLevel);
    const stats = scaledEnemyStats(enemy, level);
    return { enemyId: enemy.id, level, hp: stats.maxHp, maxHp: stats.maxHp };
  });
}

/** Every 5th wave per the design doc's milestone table (wave 5 -> Bonus Chest, 10 -> Boss Chest,
 *  15 -> Rare Reward, 20+ -> higher tier). */
export function isMilestoneWave(wave: number): boolean {
  return wave > 0 && wave % 5 === 0;
}

/** Reuses the Daily Chest system's two existing tiers rather than inventing "Boss Chest"/"Rare
 *  Reward" as separate new reward tables - wave 5 rolls a Standard-tier bonus, wave 10+ rolls
 *  Elite (which already skews toward better gold/materials/equipment chances, matching the doc's
 *  "higher tier rewards" intent for later milestones without a third reward table to maintain). */
export function milestoneChestTier(wave: number): ChestTier {
  return wave >= 10 ? 'elite' : 'standard';
}
