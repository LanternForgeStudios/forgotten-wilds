import { BOSS_REGION_LOCATIONS, ENCOUNTER_TABLES, ENEMIES, type EnemyDefinition } from '../data/enemies';
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

/** Weighted toward fewer adds so a mostly-solo boss stays the common case: 40% zero adds, 30% one,
 *  20% two, 10% three. Deliberately not tied to player level (unlike maxEncounterSizeForLevel,
 *  which sizes ambient wandering encounters) - a boss's entourage is a fixed range regardless of
 *  how strong the player has become. */
const ADD_COUNT_WEIGHTS = [40, 30, 20, 10];

function rollAddCount(): number {
  const totalWeight = ADD_COUNT_WEIGHTS.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  for (let count = 0; count < ADD_COUNT_WEIGHTS.length; count++) {
    roll -= ADD_COUNT_WEIGHTS[count];
    if (roll <= 0) return count;
  }
  return 0;
}

/** Rolls a boss fight's full roster: 0-3 additional enemies ("adds"), each independently drawn
 *  from a random location within the boss's own region (BOSS_REGION_LOCATIONS) via the exact same
 *  rollEnemyForLocation path a normal wandering encounter uses, followed by the boss itself.
 *  Adds are returned FIRST, boss LAST - not just cosmetic: the client defaults the initial/
 *  death-reassigned target to the first array entry, so this ordering makes an add the default
 *  target for free, only falling through to the boss once every add is dead. */
export function rollBossEncounter(bossId: string): EnemyDefinition[] {
  const regionLocationIds = BOSS_REGION_LOCATIONS[bossId];
  if (!regionLocationIds || regionLocationIds.length === 0) {
    throw new Error(`No region locations configured for boss "${bossId}".`);
  }
  const addCount = rollAddCount();
  const adds: EnemyDefinition[] = [];
  for (let i = 0; i < addCount; i++) {
    const locationId = regionLocationIds[Math.floor(Math.random() * regionLocationIds.length)];
    adds.push(rollEnemyForLocation(locationId));
  }
  return [...adds, ENEMIES[bossId]];
}

export const MIN_ENEMY_LEVEL = 1;
// Half the player level cap (MAX_LEVEL in data/leveling.ts) - baseLevel below is player level/2,
// so this lets enemy level keep climbing all the way to a level-100 player instead of flatlining
// once the player passes level ~10 (this used to be 5, which - combined with every location being
// quest-gated rather than level-gated, so a player can grind indefinitely in an already-unlocked
// region - meant every enemy everywhere permanently stopped scaling early while the player's own
// stats kept climbing without bound).
export const MAX_ENEMY_LEVEL = 50;

/** Per-enemy-level stat growth, additive like the player's own STAT_GROWTH_PER_LEVEL - 2x the
 *  player's rate for maxHp/defense/speed, because enemy level advances at half the player's rate
 *  (baseLevel below), so over the full 1-100 player range that's 99 player level-ups against only
 *  49 enemy level-ups, a ratio of ~2.02 that this constant reproduces cleanly. Replaces the old
 *  multiplicative `levelMultiplier` (1 + (level-1)*0.15), which topped out at a shallow 1.6x at
 *  the old level-5 cap - far too weak to keep pace with a player whose own stats grow additively
 *  to level 100.
 *
 *  `attack` deliberately breaks the clean 2x pattern (3x instead of 4x): a multi-enemy fight has
 *  every alive enemy attacking every round while the player can only hit one target per turn, an
 *  O(N^2)-ish compounding effect a fair 1-on-1 rate doesn't account for - verified numerically
 *  that even a "fair" 1-on-1 fight already consumed 68-96% of the player's max HP to solo-kill one
 *  enemy at high levels, leaving no headroom for a group fight's extra rounds. See
 *  CROWD_DAMAGE_FACTOR below for the other half of this fix (the actual N-attackers mechanism). */
const ENEMY_STAT_GROWTH_PER_LEVEL = { maxHp: 16, attack: 3, defense: 2, speed: 2 };

/** Bosses grow 3x as fast per level as regular/elite enemies. Applying the same rate to both
 *  (verified numerically) collapses a boss's authored stat lead (e.g. the Coalbound Warden's
 *  ~4.1x maxHp lead over a trash mob) down to a barely-there ~1.1x by level 100 - it stops
 *  feeling like a boss. This keeps a boss at a stable ~2.8-3.1x advantage across the whole
 *  1-100 player range instead. */
const BOSS_STAT_GROWTH_MULTIPLIER = 3;
const BOSS_STAT_GROWTH_PER_LEVEL = {
  maxHp: ENEMY_STAT_GROWTH_PER_LEVEL.maxHp * BOSS_STAT_GROWTH_MULTIPLIER,
  attack: ENEMY_STAT_GROWTH_PER_LEVEL.attack * BOSS_STAT_GROWTH_MULTIPLIER,
  defense: ENEMY_STAT_GROWTH_PER_LEVEL.defense * BOSS_STAT_GROWTH_MULTIPLIER,
  speed: ENEMY_STAT_GROWTH_PER_LEVEL.speed * BOSS_STAT_GROWTH_MULTIPLIER,
};

/** Reward scaling has its own slope - it doesn't need to move at the same rate as stat scaling.
 *  Multiplicative, so it preserves the boss/trash reward ratio exactly at every level - only
 *  additive stat scaling needed a boss-specific rate (see BOSS_STAT_GROWTH_PER_LEVEL). */
const REWARD_GROWTH_PER_LEVEL = 0.5;

/** Every enemy (including bosses) rolls a level (1-50) that scales stats and rewards up, tracking
 *  the player's own level so encounters stay a fair fight from level 1 through level 100 (see
 *  ENEMY_STAT_GROWTH_PER_LEVEL / BOSS_STAT_GROWTH_PER_LEVEL, which is where boss vs. regular/elite
 *  differentiation now happens - this roll itself no longer depends on which enemy it's for).
 *  Bosses used to always return a fixed level 1 - a boss's difficulty now comes from its much
 *  higher authored base stats plus its own steeper growth rate, not from skipping scaling entirely. */
export function rollEnemyLevel(playerLevel: number): number {
  const baseLevel = Math.max(MIN_ENEMY_LEVEL, Math.round(playerLevel / 2));
  const jitter = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
  return Math.min(MAX_ENEMY_LEVEL, Math.max(MIN_ENEMY_LEVEL, baseLevel + jitter));
}

export interface ScaledEnemyStats {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

/** The enemy's real in-combat stats - its authored base stats plus additive per-level growth,
 *  structurally parallel to how the player's own stats grow. Level 1 is exactly the authored
 *  base. Elites and regulars (and now bosses) roll from the same level distribution, so an
 *  elite's or boss's authored base-stat edge persists as a real (if proportionally shrinking)
 *  advantage at every level rather than being cancelled out by a level penalty - bosses use their
 *  own steeper growth rate (BOSS_STAT_GROWTH_PER_LEVEL) so that edge stays meaningful at endgame. */
export function scaledEnemyStats(enemy: EnemyDefinition, level: number): ScaledEnemyStats {
  const levelsAboveOne = level - 1;
  const growth = enemy.tier === 'boss' ? BOSS_STAT_GROWTH_PER_LEVEL : ENEMY_STAT_GROWTH_PER_LEVEL;
  return {
    maxHp: enemy.stats.maxHp + growth.maxHp * levelsAboveOne,
    attack: enemy.stats.attack + growth.attack * levelsAboveOne,
    defense: enemy.stats.defense + growth.defense * levelsAboveOne,
    speed: enemy.stats.speed + growth.speed * levelsAboveOne,
  };
}

/** xp/gold scale the same way (a higher-level roll of the same enemy is worth proportionally more
 *  to defeat), on their own slope independent of how stats scale. */
export function scaledEnemyRewards(enemy: EnemyDefinition, level: number): { xp: number; gold: number } {
  const m = 1 + (level - 1) * REWARD_GROWTH_PER_LEVEL;
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
  /** 1-50 for every enemy, including bosses - see rollEnemyLevel. */
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

export interface CombatHitResult {
  targetIndex: number;
  damage: number;
  missed: boolean;
  defeated: boolean;
}

export interface RoundResult {
  log: string[];
  playerHp: number;
  playerSpirit: number;
  playerLanternOil: number;
  /** Updated hp for every enemy in the roster, same order as the input. */
  enemyHp: number[];
  phase: RoundOutcomePhase;
  /** Every item id consumed this round (0-3 entries, duplicates allowed if the same item was used
   *  more than once). Always an array, even when empty. */
  itemConsumedIds: string[];
  /** Every enemy the player damaged/missed this round via attack/skill/offensive lanternAbility. */
  hits: CombatHitResult[];
  /** Sum of all enemy->player damage this round (after Defend halving is applied). */
  damageTakenByPlayer: number;
}

/** Groups a (possibly duplicate-laden) list of item ids into counts per id, capped at 3 total uses
 *  per round - shared by the engine (applying effects) and resolveCombatAction.ts (validating
 *  ownership/quantity before ever calling resolveRound). */
export function aggregateItemCounts(itemIds: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of itemIds.slice(0, 3)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Whether the player's inventory covers every requested item use this round, accounting for
 *  duplicate ids (e.g. 2x the same potion needs quantity >= 2). */
export function hasSufficientQuantity(
  itemIds: string[],
  inventory: { itemId: string; quantity: number }[],
): boolean {
  for (const [itemId, count] of aggregateItemCounts(itemIds)) {
    if ((inventory.find((i) => i.itemId === itemId)?.quantity ?? 0) < count) return false;
  }
  return true;
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
const TARGET_ALL_MISS_CHANCE = 0.15;
const TARGET_ALL_DAMAGE_FACTOR = 0.6;

/** Dampens each non-boss enemy's own attack damage based on how many non-boss enemies are
 *  currently alive (self-inclusive) - every alive enemy attacks every round while the player can
 *  only hit one target per turn, so without this an N-enemy fight is roughly N times harder than
 *  a 1-on-1 fight even though the underlying per-hit numbers are individually fair (verified
 *  numerically: undamped, a 3-enemy fight killed the player before they could even finish off the
 *  first enemy, at every player level). A boss's own attack is never dampened (see enemyAttack) -
 *  only its "adds" are, and only by how many adds are alive, so a boss fought alone or with 0-1
 *  adds is completely unaffected by this table. */
const CROWD_DAMAGE_FACTOR: Record<number, number> = { 1: 1, 2: 0.12, 3: 0.05, 4: 0.035, 5: 0.025, 6: 0.02 };

export function resolveRound(input: RoundInput): RoundResult {
  const { action } = input;
  const log: string[] = [];
  let playerHp = input.playerStats.hp;
  let playerSpirit = input.playerStats.spirit;
  let playerLanternOil = input.playerStats.lanternOil;
  let damageTakenByPlayer = 0;
  const itemConsumedIds: string[] = [];
  const hits: CombatHitResult[] = [];

  // Decided up front, from the action alone - NOT set mid-loop by playerTurn() - so that every
  // enemy attack this round is halved consistently, regardless of turn-order/speed. Previously
  // this was a mid-loop side effect of playerTurn(), which meant any enemy faster than the player
  // (and therefore resolved earlier in the speed-sorted turn order) hit at full damage even though
  // the player had chosen to Defend that same round.
  const isDefensiveLanternAbility =
    action.type === 'lanternAbility' &&
    !!action.abilityId &&
    LANTERN_ABILITIES[action.abilityId]?.category === 'defensive';
  const playerDefending = action.type === 'defend' || isDefensiveLanternAbility;

  const enemyHp = input.enemies.map((e) => e.hp);
  const enemyDefs = input.enemies.map((e) => ENEMIES[e.enemyId]);
  const enemyStats = input.enemies.map((e, i) => scaledEnemyStats(enemyDefs[i], e.level));

  const isAlive = (i: number) => enemyHp[i] > 0;
  const aliveIndices = () => enemyHp.map((_, i) => i).filter(isAlive);
  const aliveNonBossCount = () => aliveIndices().filter((i) => enemyDefs[i].tier !== 'boss').length;

  function damageEnemy(i: number, dmg: number, verb: string): boolean {
    const before = enemyHp[i];
    enemyHp[i] = Math.max(0, before - dmg);
    log.push(`${verb} ${enemyDefs[i].name} for ${dmg} damage.`);
    const defeated = before > 0 && enemyHp[i] <= 0;
    if (defeated) log.push(`${enemyDefs[i].name} is defeated!`);
    return defeated;
  }

  function enemyAttack(i: number) {
    if (!isAlive(i)) return;
    const def = enemyDefs[i];
    const stats = enemyStats[i];
    const hpFraction = enemyHp[i] / stats.maxHp;
    const move = pickEnemyMove(def, hpFraction);
    const skill = SKILLS[move.skillId] ?? SKILLS.attack;
    let dmg = computeDamage(skill.power, stats.attack, input.playerStats.defense);
    if (def.tier !== 'boss') {
      const crowdFactor = CROWD_DAMAGE_FACTOR[Math.min(6, aliveNonBossCount())] ?? 1;
      dmg = Math.max(1, Math.round(dmg * crowdFactor));
    }
    if (playerDefending) dmg = Math.round(dmg / 2);
    playerHp = Math.max(0, playerHp - dmg);
    damageTakenByPlayer += dmg;
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

  /** Shared by attack/skill/offensive-lanternAbility: hits either the resolved single target, or
   *  every living enemy when `action.targetAll` is set and more than one is alive (each rolled and
   *  scaled independently - own defense, own variance, own miss chance). Falls back to normal
   *  single-target behavior (no reduction, no miss) once only one enemy remains. */
  function resolveOffensiveHits(power: number, verb: string, bonusMultiplier: (enemyIdx: number) => number = () => 1) {
    const alive = aliveIndices();
    const useAll = !!action.targetAll && alive.length > 1;
    const targets = useAll ? alive : [resolveTargetIndex()].filter((i): i is number => i !== undefined);

    for (const i of targets) {
      const missed = useAll && Math.random() < TARGET_ALL_MISS_CHANCE;
      if (missed) {
        log.push(`Your attack on ${enemyDefs[i].name} goes wide - miss!`);
        hits.push({ targetIndex: i, damage: 0, missed: true, defeated: false });
        continue;
      }
      let dmg = Math.round(computeDamage(power, input.playerStats.attack, enemyStats[i].defense) * bonusMultiplier(i));
      if (useAll) dmg = Math.max(1, Math.round(dmg * TARGET_ALL_DAMAGE_FACTOR));
      const defeated = damageEnemy(i, dmg, verb);
      hits.push({ targetIndex: i, damage: dmg, missed: false, defeated });
    }
  }

  function consumeItems(itemIds: string[]) {
    for (const [itemId, count] of aggregateItemCounts(itemIds)) {
      const def = ITEMS[itemId];
      if (!def?.effect) continue;
      for (let n = 0; n < count; n++) itemConsumedIds.push(itemId);

      let healHpTotal = 0;
      let healSpiritTotal = 0;
      let restoreOilTotal = 0;
      for (let n = 0; n < count; n++) {
        if (def.effect.healHpPercent) {
          const before = playerHp;
          const amount = Math.round(input.playerStats.maxHp * def.effect.healHpPercent);
          playerHp = Math.min(input.playerStats.maxHp, playerHp + amount);
          healHpTotal += playerHp - before;
        }
        if (def.effect.healSpiritPercent) {
          const before = playerSpirit;
          const amount = Math.round(input.playerStats.maxSpirit * def.effect.healSpiritPercent);
          playerSpirit = Math.min(input.playerStats.maxSpirit, playerSpirit + amount);
          healSpiritTotal += playerSpirit - before;
        }
        if (def.effect.restoreOil) {
          const before = playerLanternOil;
          playerLanternOil = Math.min(input.playerStats.maxLanternOil, playerLanternOil + def.effect.restoreOil);
          restoreOilTotal += playerLanternOil - before;
        }
      }

      const label = itemId.replace(/-/g, ' ');
      const suffix = count > 1 ? ` x${count}` : '';
      if (healHpTotal > 0) log.push(`You use ${label}${suffix} and recover ${healHpTotal} HP.`);
      if (healSpiritTotal > 0) log.push(`You use ${label}${suffix} and recover ${healSpiritTotal} Spirit.`);
      if (restoreOilTotal > 0) log.push(`You use ${label}${suffix} and restore ${restoreOilTotal} Lantern Oil.`);
    }
  }

  function playerTurn() {
    switch (action.type) {
      case 'attack':
        resolveOffensiveHits(SKILLS.attack.power, 'You strike');
        break;
      case 'skill': {
        const skill = SKILLS[action.skillId ?? 'keepers-strike'];
        playerSpirit = Math.max(0, playerSpirit - skill.spiritCost);
        resolveOffensiveHits(skill.power, "Keeper's Strike hits");
        break;
      }
      case 'lanternAbility': {
        const ability = action.abilityId ? LANTERN_ABILITIES[action.abilityId] : undefined;
        if (!ability) break;
        playerLanternOil = Math.max(0, playerLanternOil - ability.oilCost);
        if (ability.category === 'offensive') {
          resolveOffensiveHits(
            ability.power ?? 0,
            `${ability.name} sears`,
            (i) => (ability.effectiveAgainstFamilies?.includes(enemyDefs[i].family) ? 1.5 : 1),
          );
        } else if (ability.category === 'healing') {
          const healed = Math.min(input.playerStats.maxHp - playerHp, ability.healHp ?? 0);
          playerHp = Math.min(input.playerStats.maxHp, playerHp + (ability.healHp ?? 0));
          log.push(`${ability.name} draws on the lantern's warmth, restoring ${healed} HP.`);
        } else {
          log.push(`${ability.name} wraps you in the lantern's glow, ready to blunt the next blow.`);
        }
        break;
      }
      case 'item':
        break; // fully handled by consumeItems() below, run unconditionally before this switch
      case 'defend':
        log.push('You brace yourself, ready to absorb the next blow.');
        break;
      case 'flee':
        break; // handled before the turn-order loop, never reached here
    }
  }

  // Items never cost a turn or trigger an extra enemy attack - they're consumed once, up front,
  // regardless of what the primary action (attack/skill/lanternAbility/defend/flee/item) turns
  // out to be.
  consumeItems(action.itemIds ?? []);

  if (action.type === 'flee') {
    const alive = aliveIndices();
    const avgSpeed = alive.length ? alive.reduce((sum, i) => sum + enemyStats[i].speed, 0) / alive.length : 0;
    const fleeChance = Math.min(0.9, Math.max(0.1, 0.3 + (input.playerStats.speed - avgSpeed) * 0.05));
    if (Math.random() < fleeChance) {
      log.push('You break away and flee the fight.');
      return { log, playerHp, playerSpirit, playerLanternOil, enemyHp, phase: 'fled', itemConsumedIds, hits, damageTakenByPlayer };
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

  return { log, playerHp, playerSpirit, playerLanternOil, enemyHp, phase, itemConsumedIds, hits, damageTakenByPlayer };
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
  /** True to skip this enemy's lootTable roll entirely - used for a boss already defeated before
   *  this fight (being refought): xp/gold still pay out normally, but its guaranteed/special item
   *  drops don't repeat. Explicit rather than relying on those items happening to be marked
   *  `unique: true` (which stops a *duplicate* grant, but doesn't stop the roll/log from firing,
   *  and wouldn't protect a future boss drop that isn't marked unique). */
  skipLoot?: boolean;
}

/** Sums xp/gold/loot across every enemy defeated in the fight (called once, at full-clear
 *  victory, with the complete roster - not incrementally per kill), scaled by each one's level. */
export function computeRewards(defeated: DefeatedEnemy[], currentXp: number, currentLevel: number): RewardResult {
  const lootItemIds: string[] = [];
  let totalXp = 0;
  let totalGold = 0;

  for (const { enemyId, level, skipLoot } of defeated) {
    const enemy = ENEMIES[enemyId];
    const reward = scaledEnemyRewards(enemy, level);
    totalXp += reward.xp;
    totalGold += reward.gold;
    if (skipLoot) continue;
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
