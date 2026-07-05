import { ENCOUNTER_TABLES, ENEMIES, type EnemyDefinition } from '../data/enemies';
import { SKILLS } from '../data/skills';
import { ITEMS } from '../data/items';
import { LANTERN_ABILITIES } from '../data/lanternAbilities';
import { levelForXp, STAT_GROWTH_PER_LEVEL } from '../data/leveling';
import type { CombatAction, Stats } from '../shared-types';

export function rollEnemyForLocation(locationId: string): EnemyDefinition {
  const table = ENCOUNTER_TABLES[locationId];
  if (!table || table.length === 0) {
    throw new Error(`No encounter table for location "${locationId}".`);
  }
  const totalWeight = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return ENEMIES[entry.enemyId];
  }
  return ENEMIES[table[0].enemyId];
}

const MIN_ENCOUNTER_SIZE = 1;
const MAX_ENCOUNTER_SIZE = 6;

/** Caps how many enemies a single encounter can roll, scaled to the player's level - a level 1
 *  character facing all 6 enemies at once (every one of which also gets its own attack that same
 *  round) is an unwinnable fight, not a challenging one. Reaches the full MAX_ENCOUNTER_SIZE only
 *  at level 10 (the level cap); a fresh level 1-2 character only ever meets a single enemy. */
export function maxEncounterSizeForLevel(playerLevel: number): number {
  return Math.min(MAX_ENCOUNTER_SIZE, 1 + Math.floor(playerLevel / 2));
}

/** Rolls a group of enemies (mixed types, each drawn independently from the location's encounter
 *  table) for a regular encounter, sized 1 up to maxEncounterSizeForLevel(playerLevel) - see that
 *  function for why group size can't just be a flat 1-6 regardless of how strong the player is.
 *  Boss fights don't go through this - they're always a single scripted enemy, handled directly by
 *  the caller. */
export function rollEncounterGroup(locationId: string, playerLevel: number): EnemyDefinition[] {
  const maxSize = maxEncounterSizeForLevel(playerLevel);
  const count = MIN_ENCOUNTER_SIZE + Math.floor(Math.random() * (maxSize - MIN_ENCOUNTER_SIZE + 1));
  const enemies: EnemyDefinition[] = [];
  for (let i = 0; i < count; i++) {
    enemies.push(rollEnemyForLocation(locationId));
  }
  return enemies;
}

export const MIN_ENEMY_LEVEL = 1;
export const MAX_ENEMY_LEVEL = 5;
/** Bosses never roll a level - this is the fixed value used purely so the same scaling math
 *  path can run for every enemy without a boss-shaped special case. */
export const BOSS_LEVEL = 1;

function levelMultiplier(level: number): number {
  return 1 + (level - 1) * 0.15;
}

/** Regular/Elite encounters roll a level (1-5) that scales stats and rewards up - factors the
 *  player's own level (so encounters roughly track how far they've progressed) and the enemy's
 *  innate potency (an already-hard-hitting enemy gets a slightly lower level ceiling, so overall
 *  threat stays balanced across the roster rather than compounding on top of an already-strong
 *  base). Bosses always return BOSS_LEVEL - their difficulty is exactly what's hand-authored. */
export function rollEnemyLevel(playerLevel: number, enemy: EnemyDefinition): number {
  if (enemy.tier === 'boss') return BOSS_LEVEL;
  const baseLevel = Math.max(MIN_ENEMY_LEVEL, Math.round(playerLevel / 2));
  const potencyDamper = enemy.stats.attack >= 10 ? 1 : 0;
  const jitter = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
  return Math.min(MAX_ENEMY_LEVEL, Math.max(MIN_ENEMY_LEVEL, baseLevel + jitter - potencyDamper));
}

export interface ScaledEnemyStats {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

/** The enemy's real in-combat stats - its authored base stats multiplied by its rolled level.
 *  Level 1 is exactly the authored base; level 5 is 60% stronger across the board. */
export function scaledEnemyStats(enemy: EnemyDefinition, level: number): ScaledEnemyStats {
  const m = levelMultiplier(level);
  return {
    maxHp: Math.round(enemy.stats.maxHp * m),
    attack: Math.round(enemy.stats.attack * m),
    defense: Math.round(enemy.stats.defense * m),
    speed: Math.round(enemy.stats.speed * m),
  };
}

/** xp/gold scale the same way stats do, so a higher-level roll of the same enemy is worth
 *  proportionally more to defeat. */
export function scaledEnemyRewards(enemy: EnemyDefinition, level: number): { xp: number; gold: number } {
  const m = levelMultiplier(level);
  return { xp: Math.round(enemy.xpReward * m), gold: Math.round(enemy.goldReward * m) };
}

function computeDamage(power: number, attackerAtk: number, defenderDef: number): number {
  const base = power + attackerAtk * 0.5 - defenderDef * 0.5;
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.round(base * variance));
}

function pickEnemyMove(enemy: EnemyDefinition, hpFraction: number) {
  const available = enemy.moves.filter((m) => !m.unlocksAtHpFraction || hpFraction <= m.unlocksAtHpFraction);
  // If every one of this enemy's moves is HP-gated above the current threshold (content bug -
  // every authored enemy today has at least one unconditional move), fall back to its first move
  // rather than returning undefined and crashing the transaction.
  if (available.length === 0) return enemy.moves[0];
  const totalWeight = available.reduce((sum, m) => sum + m.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const move of available) {
    roll -= move.weight;
    if (roll <= 0) return move;
  }
  return available[0];
}

export interface RoundEnemyInput {
  enemyId: string;
  /** 1-5 for Regular/Elite, always BOSS_LEVEL for a boss - see rollEnemyLevel. */
  level: number;
  hp: number;
}

export interface RoundInput {
  action: CombatAction;
  playerStats: Stats;
  inventory: { itemId: string; quantity: number }[];
  /** Fixed-order roster for this fight - `action.targetIndex` refers to positions in this array.
   *  Already-defeated entries (hp <= 0) are simply skipped for turn order and targeting. */
  enemies: RoundEnemyInput[];
}

export type RoundOutcomePhase = 'continue' | 'victory' | 'defeat' | 'fled';

export interface RoundResult {
  log: string[];
  playerHp: number;
  playerSpirit: number;
  playerLanternOil: number;
  /** Updated hp for every enemy in the roster, same order as the input. */
  enemyHp: number[];
  phase: RoundOutcomePhase;
  itemConsumedId?: string;
}

/** One round of turn-based combat against a roster of 1-6 enemies. Turn order is the player plus
 *  every still-alive enemy, sorted by speed descending (ties favor the player, matching the old
 *  1-enemy `playerFirst = playerSpeed >= enemySpeed` rule). The player's single action can only
 *  target one enemy (attack/skill/lanternAbility); every other living enemy still gets its own
 *  turn against the player the same round - that's what makes a group of weaker enemies dangerous
 *  in aggregate even though the player only ever swings at one of them per round. Each enemy's
 *  stats here are its level-scaled stats (see scaledEnemyStats), not its raw authored base.
 *
 *  Two independent resource-gated action families: 'skill' (a Specialty Attack, cost in Spirit)
 *  and 'lanternAbility' (belongs to whichever lantern is equipped, cost in Lantern Oil) - the
 *  caller (resolveCombatAction.ts) is responsible for validating the player actually has enough
 *  of the relevant resource and, for lanternAbility, that the ability really belongs to their
 *  currently-equipped lantern, before calling this function. */
export function resolveRound(input: RoundInput): RoundResult {
  const { action } = input;
  const log: string[] = [];
  let playerHp = input.playerStats.hp;
  let playerSpirit = input.playerStats.spirit;
  let playerLanternOil = input.playerStats.lanternOil;
  let playerDefending = false;
  let itemConsumedId: string | undefined;

  const enemyHp = input.enemies.map((e) => e.hp);
  const enemyDefs = input.enemies.map((e) => ENEMIES[e.enemyId]);
  const enemyStats = input.enemies.map((e, i) => scaledEnemyStats(enemyDefs[i], e.level));

  const isAlive = (i: number) => enemyHp[i] > 0;
  const aliveIndices = () => enemyHp.map((_, i) => i).filter(isAlive);

  function damageEnemy(i: number, dmg: number, verb: string) {
    const before = enemyHp[i];
    enemyHp[i] = Math.max(0, before - dmg);
    log.push(`${verb} ${enemyDefs[i].name} for ${dmg} damage.`);
    if (before > 0 && enemyHp[i] <= 0) {
      log.push(`${enemyDefs[i].name} is defeated!`);
    }
  }

  function enemyAttack(i: number) {
    if (!isAlive(i)) return;
    const def = enemyDefs[i];
    const stats = enemyStats[i];
    const hpFraction = enemyHp[i] / stats.maxHp;
    const move = pickEnemyMove(def, hpFraction);
    const skill = SKILLS[move.skillId] ?? SKILLS.attack;
    let dmg = computeDamage(skill.power, stats.attack, input.playerStats.defense);
    if (playerDefending) dmg = Math.round(dmg / 2);
    playerHp = Math.max(0, playerHp - dmg);
    log.push(
      `${def.name} uses ${move.skillId.replace(/-/g, ' ')} for ${dmg} damage${
        playerDefending ? ' (halved - you defended)' : ''
      }.`,
    );
  }

  function resolveTargetIndex(): number | undefined {
    const alive = aliveIndices();
    if (alive.length === 0) return undefined;
    const requested = action.targetIndex;
    if (requested !== undefined && isAlive(requested)) return requested;
    return alive[0];
  }

  function playerTurn() {
    switch (action.type) {
      case 'attack': {
        const i = resolveTargetIndex();
        if (i === undefined) break;
        const dmg = computeDamage(SKILLS.attack.power, input.playerStats.attack, enemyStats[i].defense);
        damageEnemy(i, dmg, 'You strike');
        break;
      }
      case 'skill': {
        const skill = SKILLS[action.skillId ?? 'keepers-strike'];
        playerSpirit = Math.max(0, playerSpirit - skill.spiritCost);
        const i = resolveTargetIndex();
        if (i === undefined) break;
        const dmg = computeDamage(skill.power, input.playerStats.attack, enemyStats[i].defense);
        damageEnemy(i, dmg, "Keeper's Strike hits");
        break;
      }
      case 'lanternAbility': {
        const ability = action.abilityId ? LANTERN_ABILITIES[action.abilityId] : undefined;
        if (!ability) break;
        playerLanternOil = Math.max(0, playerLanternOil - ability.oilCost);
        if (ability.category === 'offensive') {
          const i = resolveTargetIndex();
          if (i === undefined) break;
          const bonus = ability.effectiveAgainstFamilies?.includes(enemyDefs[i].family) ? 1.5 : 1;
          const dmg = Math.round(computeDamage(ability.power ?? 0, input.playerStats.attack, enemyStats[i].defense) * bonus);
          damageEnemy(i, dmg, `${ability.name} sears${bonus > 1 ? ' (super effective!)' : ''}`);
        } else if (ability.category === 'healing') {
          const healed = Math.min(input.playerStats.maxHp - playerHp, ability.healHp ?? 0);
          playerHp = Math.min(input.playerStats.maxHp, playerHp + (ability.healHp ?? 0));
          log.push(`${ability.name} draws on the lantern's warmth, restoring ${healed} HP.`);
        } else {
          playerDefending = true;
          log.push(`${ability.name} wraps you in the lantern's glow, ready to blunt the next blow.`);
        }
        break;
      }
      case 'item': {
        const itemId = action.itemId!;
        const def = ITEMS[itemId];
        itemConsumedId = itemId;
        if (def.effect?.healHp) {
          playerHp = Math.min(input.playerStats.maxHp, playerHp + def.effect.healHp);
          log.push(`You use ${itemId.replace(/-/g, ' ')} and recover ${def.effect.healHp} HP.`);
        }
        if (def.effect?.healSpirit) {
          playerSpirit = Math.min(input.playerStats.maxSpirit, playerSpirit + def.effect.healSpirit);
          log.push(`You use ${itemId.replace(/-/g, ' ')} and recover ${def.effect.healSpirit} Spirit.`);
        }
        if (def.effect?.restoreOil) {
          playerLanternOil = Math.min(input.playerStats.maxLanternOil, playerLanternOil + def.effect.restoreOil);
          log.push(`You use ${itemId.replace(/-/g, ' ')} and restore ${def.effect.restoreOil} Lantern Oil.`);
        }
        break;
      }
      case 'defend': {
        playerDefending = true;
        log.push('You brace yourself, ready to absorb the next blow.');
        break;
      }
      case 'flee':
        break; // handled before the turn-order loop, never reached here
    }
  }

  if (action.type === 'flee') {
    const alive = aliveIndices();
    const avgSpeed = alive.length ? alive.reduce((sum, i) => sum + enemyStats[i].speed, 0) / alive.length : 0;
    const fleeChance = Math.min(0.9, Math.max(0.1, 0.3 + (input.playerStats.speed - avgSpeed) * 0.05));
    if (Math.random() < fleeChance) {
      log.push('You break away and flee the fight.');
      return { log, playerHp, playerSpirit, playerLanternOil, enemyHp, phase: 'fled' };
    }
    log.push('You try to flee, but there is no opening! Every foe still standing gets a free hit.');
    for (const i of alive) enemyAttack(i);
  } else {
    type Turn = { kind: 'player'; speed: number } | { kind: 'enemy'; index: number; speed: number };
    const alive = aliveIndices();
    const turns: Turn[] = [
      { kind: 'player', speed: input.playerStats.speed },
      ...alive.map((i): Turn => ({ kind: 'enemy', index: i, speed: enemyStats[i].speed })),
    ];
    // Stable sort keeps the player (listed first) ahead of any enemy at the same speed.
    turns.sort((a, b) => b.speed - a.speed);

    for (const turn of turns) {
      if (playerHp <= 0) break;
      if (turn.kind === 'player') playerTurn();
      else if (isAlive(turn.index)) enemyAttack(turn.index);
    }
  }

  const allDefeated = enemyHp.every((hp) => hp <= 0);
  let phase: RoundOutcomePhase = 'continue';
  if (allDefeated) phase = 'victory';
  else if (playerHp <= 0) phase = 'defeat';

  return { log, playerHp, playerSpirit, playerLanternOil, enemyHp, phase, itemConsumedId };
}

export interface RewardResult {
  xp: number;
  gold: number;
  lootItemIds: string[];
  leveledUp: boolean;
  newLevel: number;
  statGrowth: Partial<Stats>;
}

export interface DefeatedEnemy {
  enemyId: string;
  level: number;
}

/** Sums xp/gold/loot across every enemy defeated in the fight (called once, at full-clear
 *  victory, with the complete roster - not incrementally per kill), scaled by each one's level. */
export function computeRewards(defeated: DefeatedEnemy[], currentXp: number, currentLevel: number): RewardResult {
  const lootItemIds: string[] = [];
  let totalXp = 0;
  let totalGold = 0;

  for (const { enemyId, level } of defeated) {
    const enemy = ENEMIES[enemyId];
    const reward = scaledEnemyRewards(enemy, level);
    totalXp += reward.xp;
    totalGold += reward.gold;
    for (const drop of enemy.lootTable) {
      if (Math.random() < drop.chance) {
        const qty = drop.minQuantity + Math.floor(Math.random() * (drop.maxQuantity - drop.minQuantity + 1));
        for (let i = 0; i < qty; i++) lootItemIds.push(drop.itemId);
      }
    }
  }

  const newXp = currentXp + totalXp;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > currentLevel;
  const levelsGained = newLevel - currentLevel;

  const statGrowth: Partial<Stats> = leveledUp
    ? {
        maxHp: STAT_GROWTH_PER_LEVEL.maxHp * levelsGained,
        maxSpirit: STAT_GROWTH_PER_LEVEL.maxSpirit * levelsGained,
        maxStamina: STAT_GROWTH_PER_LEVEL.maxStamina * levelsGained,
        attack: STAT_GROWTH_PER_LEVEL.attack * levelsGained,
        defense: STAT_GROWTH_PER_LEVEL.defense * levelsGained,
        speed: STAT_GROWTH_PER_LEVEL.speed * levelsGained,
      }
    : {};

  return { xp: totalXp, gold: totalGold, lootItemIds, leveledUp, newLevel, statGrowth };
}
