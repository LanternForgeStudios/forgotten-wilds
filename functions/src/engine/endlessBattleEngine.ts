// Pure wave/reward math for Endless Battle (functions/src/functions/endlessBattle.ts) - kept
// separate from partyCombatEngine.ts (which only resolves one round at a time and has no notion
// of "waves" at all) so both stay independently testable.

import { ENEMIES, type EnemyDefinition } from '../data/enemies';
import { maxEncounterSizeForLevel, rollEnemyLevel, scaledEnemyStats } from './combatEngine';
import type { ChestTier } from './dailyChestEngine';
import type { PartyBattleEnemyState } from '../shared-types';

const MIN_ENCOUNTER_SIZE = 1;
const NON_BOSS_ENEMIES = Object.values(ENEMIES).filter((e) => e.tier !== 'boss');
const BOSS_ENEMIES = Object.values(ENEMIES).filter((e) => e.tier === 'boss');

function rollAnyNonBossEnemy(): EnemyDefinition {
  return NON_BOSS_ENEMIES[Math.floor(Math.random() * NON_BOSS_ENEMIES.length)];
}

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

/** Rolls one wave's enemy roster from every non-boss enemy defined in the game, not any one
 *  region's encounter table - Endless Battle is a clan activity fought wherever the party happens
 *  to gather (a Town, since that's the only place clan members can actually see each other - see
 *  endlessBattle.ts), not tied to a specific wilderness area the way a solo encounter is. Group
 *  size still scales with effective level via the same maxEncounterSizeForLevel a solo encounter
 *  uses. Milestone waves (5, 10, 15, 20...) always include one random boss-tier enemy - the design
 *  doc's "boss encounters every 5 or 10 waves" - alongside 0-2 regular "adds", mirroring
 *  rollBossEncounter's own adds concept but drawn from the full roster instead of one boss's
 *  region. */
export function rollWaveEnemies(wave: number, partyAverageLevel: number): PartyBattleEnemyState[] {
  const effectiveLevel = effectiveLevelForWave(wave, partyAverageLevel);
  const roster: EnemyDefinition[] = [];

  if (isMilestoneWave(wave) && BOSS_ENEMIES.length > 0) {
    const boss = BOSS_ENEMIES[Math.floor(Math.random() * BOSS_ENEMIES.length)];
    const addCount = Math.floor(Math.random() * 3); // 0-2 adds alongside the boss
    for (let i = 0; i < addCount; i++) roster.push(rollAnyNonBossEnemy());
    roster.push(boss); // last, same "boss is the default final target" ordering as rollBossEncounter
  } else {
    const maxSize = maxEncounterSizeForLevel(effectiveLevel);
    const count = MIN_ENCOUNTER_SIZE + Math.floor(Math.random() * (maxSize - MIN_ENCOUNTER_SIZE + 1));
    for (let i = 0; i < count; i++) roster.push(rollAnyNonBossEnemy());
  }

  return roster.map((enemy) => {
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
