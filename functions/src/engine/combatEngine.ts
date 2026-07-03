import { ENCOUNTER_TABLES, ENEMIES, type EnemyDefinition } from '../data/enemies';
import { SKILLS } from '../data/skills';
import { ITEMS } from '../data/items';
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

function computeDamage(power: number, attackerAtk: number, defenderDef: number): number {
  const base = power + attackerAtk * 0.5 - defenderDef * 0.5;
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.round(base * variance));
}

function pickEnemyMove(enemy: EnemyDefinition, enemyHp: number) {
  const hpFraction = enemyHp / enemy.stats.maxHp;
  const available = enemy.moves.filter((m) => !m.unlocksAtHpFraction || hpFraction <= m.unlocksAtHpFraction);
  const totalWeight = available.reduce((sum, m) => sum + m.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const move of available) {
    roll -= move.weight;
    if (roll <= 0) return move;
  }
  return available[0];
}

export interface RoundInput {
  action: CombatAction;
  playerStats: Stats;
  inventory: { itemId: string; quantity: number }[];
  enemy: EnemyDefinition;
  enemyHp: number;
  enemyName: string;
}

export type RoundOutcomePhase = 'continue' | 'victory' | 'defeat' | 'fled';

export interface RoundResult {
  log: string[];
  playerHp: number;
  playerSpirit: number;
  enemyHp: number;
  phase: RoundOutcomePhase;
  itemConsumedId?: string;
  fleeAttempted: boolean;
}

export function resolveRound(input: RoundInput): RoundResult {
  const { action, enemy } = input;
  const log: string[] = [];
  let playerHp = input.playerStats.hp;
  let playerSpirit = input.playerStats.spirit;
  let enemyHp = input.enemyHp;
  let playerDefending = false;
  let itemConsumedId: string | undefined;
  let fleeAttempted = false;

  const playerFirst = input.playerStats.speed >= enemy.stats.speed;

  function playerTurn() {
    switch (action.type) {
      case 'attack': {
        const dmg = computeDamage(SKILLS.attack.power, input.playerStats.attack, enemy.stats.defense);
        enemyHp = Math.max(0, enemyHp - dmg);
        log.push(`You strike ${input.enemyName} for ${dmg} damage.`);
        break;
      }
      case 'skill': {
        const skill = SKILLS['keepers-strike'];
        const dmg = computeDamage(skill.power, input.playerStats.attack, enemy.stats.defense);
        enemyHp = Math.max(0, enemyHp - dmg);
        log.push(`Keeper's Strike hits ${input.enemyName} for ${dmg} damage.`);
        break;
      }
      case 'spiritArt': {
        const skill = SKILLS['lantern-flame'];
        playerSpirit = Math.max(0, playerSpirit - skill.spiritCost);
        const bonus = skill.effectiveAgainstFamilies?.includes(enemy.family) ? 1.5 : 1;
        const dmg = Math.round(computeDamage(skill.power, input.playerStats.attack, enemy.stats.defense) * bonus);
        enemyHp = Math.max(0, enemyHp - dmg);
        log.push(`Lantern Flame sears ${input.enemyName} for ${dmg} damage${bonus > 1 ? ' (super effective!)' : ''}.`);
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
        break;
      }
      case 'defend': {
        playerDefending = true;
        log.push('You brace yourself, ready to absorb the next blow.');
        break;
      }
      case 'flee': {
        fleeAttempted = true;
        break;
      }
    }
  }

  function enemyTurn() {
    if (enemyHp <= 0) return;
    const move = pickEnemyMove(enemy, enemyHp);
    const skill = SKILLS[move.skillId] ?? SKILLS.attack;
    let dmg = computeDamage(skill.power, enemy.stats.attack, input.playerStats.defense);
    if (playerDefending) dmg = Math.round(dmg / 2);
    playerHp = Math.max(0, playerHp - dmg);
    log.push(`${input.enemyName} uses ${move.skillId.replace(/-/g, ' ')} for ${dmg} damage.`);
  }

  if (action.type === 'flee') {
    const fleeChance = Math.min(0.9, Math.max(0.1, 0.3 + (input.playerStats.speed - enemy.stats.speed) * 0.05));
    fleeAttempted = true;
    if (Math.random() < fleeChance) {
      log.push('You break away and flee the fight.');
      return { log, playerHp, playerSpirit, enemyHp, phase: 'fled', fleeAttempted };
    }
    log.push('You try to flee, but there is no opening!');
    enemyTurn();
  } else if (playerFirst) {
    playerTurn();
    if (enemyHp > 0) enemyTurn();
  } else {
    enemyTurn();
    if (playerHp > 0) playerTurn();
  }

  let phase: RoundOutcomePhase = 'continue';
  if (enemyHp <= 0) phase = 'victory';
  else if (playerHp <= 0) phase = 'defeat';

  return { log, playerHp, playerSpirit, enemyHp, phase, itemConsumedId, fleeAttempted };
}

export interface RewardResult {
  xp: number;
  gold: number;
  lootItemIds: string[];
  leveledUp: boolean;
  newLevel: number;
  statGrowth: Partial<Stats>;
}

export function computeRewards(enemy: EnemyDefinition, currentXp: number, currentLevel: number): RewardResult {
  const lootItemIds: string[] = [];
  for (const drop of enemy.lootTable) {
    if (Math.random() < drop.chance) {
      const qty = drop.minQuantity + Math.floor(Math.random() * (drop.maxQuantity - drop.minQuantity + 1));
      for (let i = 0; i < qty; i++) lootItemIds.push(drop.itemId);
    }
  }

  const newXp = currentXp + enemy.xpReward;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > currentLevel;
  const levelsGained = newLevel - currentLevel;

  const statGrowth: Partial<Stats> = leveledUp
    ? {
        maxHp: STAT_GROWTH_PER_LEVEL.maxHp * levelsGained,
        maxSpirit: STAT_GROWTH_PER_LEVEL.maxSpirit * levelsGained,
        attack: STAT_GROWTH_PER_LEVEL.attack * levelsGained,
        defense: STAT_GROWTH_PER_LEVEL.defense * levelsGained,
        speed: STAT_GROWTH_PER_LEVEL.speed * levelsGained,
      }
    : {};

  return { xp: enemy.xpReward, gold: enemy.goldReward, lootItemIds, leveledUp, newLevel, statGrowth };
}
