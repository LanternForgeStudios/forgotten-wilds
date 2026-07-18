import { BOSS_REGION_LOCATIONS, ENCOUNTER_TABLES, ENEMIES, type EnemyDefinition } from '../data/enemies';
import { SKILLS, type DamageType } from '../data/skills';
import { ITEMS } from '../data/items';
import { LANTERN_ABILITIES } from '../data/lanternAbilities';
import { AILMENTS } from '../data/ailments';
import { levelForXp, STAT_GROWTH_PER_LEVEL } from '../data/leveling';
import {
  applyAilmentEntry,
  applyAilmentResistance,
  applyAilmentTickDamageToTarget,
  blindMissChance,
  computeDamage,
  pickEnemyMove,
  weightedPick,
} from './combatMath';
import type { AilmentResistance, CombatAction, Stats, ActiveAilment } from '../shared-types';

export function rollEnemyForLocation(locationId: string): EnemyDefinition {
  const table = ENCOUNTER_TABLES[locationId];
  if (!table || table.length === 0) {
    throw new Error(`No encounter table for location "${locationId}".`);
  }
  return ENEMIES[weightedPick(table, (e) => e.weight).enemyId];
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
  const counts = ADD_COUNT_WEIGHTS.map((_, count) => count);
  return weightedPick(counts, (count) => ADD_COUNT_WEIGHTS[count]);
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

/** Per-enemy-level stat growth, additive like the player's own STAT_GROWTH_PER_LEVEL. defense/
 *  speed hold to 2x the player's rate, because enemy level advances at half the player's rate
 *  (baseLevel below), so over the full 1-100 player range that's 99 player level-ups against only
 *  49 enemy level-ups, a ratio of ~2.02 that a flat 2x reproduces cleanly. Replaces the old
 *  multiplicative `levelMultiplier` (1 + (level-1)*0.15), which topped out at a shallow 1.6x at
 *  the old level-5 cap - far too weak to keep pace with a player whose own stats grow additively
 *  to level 100.
 *
 *  `attack` deliberately breaks the clean 2x pattern (3x instead of 4x): a multi-enemy fight has
 *  every alive enemy attacking every round while the player can only hit one target per turn, an
 *  O(N^2)-ish compounding effect a fair 1-on-1 rate doesn't account for - verified numerically
 *  that even a "fair" 1-on-1 fight already consumed 68-96% of the player's max HP to solo-kill one
 *  enemy at high levels, leaving no headroom for a group fight's extra rounds. See
 *  CROWD_DAMAGE_FACTOR below for the other half of this fix (the actual N-attackers mechanism).
 *
 *  `maxHp` breaks the 2x pattern too, in the other direction (5, well under the player's own rate
 *  of 8) - playtest-driven: at the original 2x-parity value (16), a solo non-boss fight climbed
 *  from 3 rounds at level 1 to 13 rounds at level 100, well past the ~4.2-round target for a
 *  normal encounter. Verified by hand (see git history) this keeps a solo fight in the 3-5 round
 *  band across the whole level range while leaving attack/defense/speed - and therefore per-hit
 *  damage and crowd-fight danger - untouched. */
const ENEMY_STAT_GROWTH_PER_LEVEL = { maxHp: 5, attack: 3, defense: 2, speed: 2 };

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

/** Every enemy (including bosses) rolls a level (1-50) that scales stats up, tracking
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

export interface RoundEnemyInput {
  enemyId: string;
  /** 1-50 for every enemy, including bosses - see rollEnemyLevel. */
  level: number;
  hp: number;
  /** Ailments this enemy is entering the round with - see EnemyDefinition.vulnerableAilments for
   *  which ailments a player can actually inflict on it. Whatever this round inflicts/cures/expires
   *  is reflected in RoundResult.enemyAilments, not here. */
  ailments: ActiveAilment[];
}

export interface RoundInput {
  action: CombatAction;
  playerStats: Stats;
  inventory: { itemId: string; quantity: number }[];
  /** Fixed-order roster for this fight - `action.targetIndex` refers to positions in this array.
   *  Already-defeated entries (hp <= 0) are simply skipped for turn order and targeting. */
  enemies: RoundEnemyInput[];
  /** Ailments the player is entering this round with - see shared-types' ActiveAilment. Whatever
   *  this round inflicts/cures/expires is reflected in RoundResult.playerAilments, not here. */
  playerAilments: ActiveAilment[];
  /** The equipped weapon's attack-ailment roll, already resolved by the caller (see
   *  equipmentEngine.ts's resolveWeaponAttackAilment) - undefined whenever no weapon is equipped
   *  or it doesn't set one. Only ever rolled for the plain 'attack' action (Skill/lanternAbility
   *  ailments come from their own data instead). Stubbed: always undefined today. */
  attackAilment?: { id: string; chance: number };
  /** The player's flattened equipped-item ailment resistance (see equipmentEngine.ts's
   *  computeAilmentResistances) - reduces the chance of an enemy's own move afflicting the player.
   *  Stubbed: always [] today. */
  ailmentResistances: AilmentResistance[];
}

export type RoundOutcomePhase = 'continue' | 'victory' | 'defeat' | 'fled';

export interface CombatHitResult {
  targetIndex: number;
  damage: number;
  missed: boolean;
  defeated: boolean;
  /** The action's damage type (attack: 'physical', skill: whatever the Skill entry says,
   *  lanternAbility: 'lantern') - drives which generic impact FX BattleScene.playOutgoingHits
   *  bursts on the target (blood/holy-light/magic-spark). Meaningless when `missed` is true (no
   *  move was ever picked to report one for). */
  damageType: DamageType;
  /** Set only when this specific hit's ailment-infliction roll actually succeeded - lets the
   *  client show that ailment's own colored FX (see BattleScene.playEnemyAilmentTakesHold)
   *  instead of the generic damageType impact effect above, so a landed Burn doesn't get buried
   *  under a redundant magic-spark burst on top of it. */
  ailmentInflicted?: string;
}

export interface EnemyHitResult {
  attackerIndex: number;
  damage: number;
  /** Always false today - enemyAttack has no miss roll (only the player's targetAll mode does).
   *  Included for shape-symmetry with CombatHitResult, so a future evasion mechanic has a real
   *  field to key off instead of a breaking client/server contract change. */
  missed: boolean;
  /** True when this hit was halved by the player's Defend (or a defensive lanternAbility) this
   *  round - see playerDefending, decided once, up front, from the action alone. */
  wasDefended: boolean;
  /** The exact same line already pushed to RoundResult.log for this attack - duplicated here so
   *  the client can reveal it in lockstep with this specific attacker's staggered animation
   *  (BattleScene.playIncomingHits) instead of dumping every round's log lines at once, which
   *  read as disconnected from a multi-enemy fight's one-attacker-at-a-time presentation. */
  logLine: string;
  /** See CombatHitResult.damageType - same generic-impact-FX purpose, just for an enemy's own
   *  move hitting the player. Meaningless when `missed` is true. */
  damageType: DamageType;
  /** See CombatHitResult.ailmentInflicted - set only when this attacker's move actually landed
   *  its ailment roll against the player this hit. */
  ailmentInflicted?: string;
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
  /** Every enemy attack that landed on the player this round, one entry per attacking enemy.
   *  Always an array, even when empty (e.g. a successful flee). */
  enemyHits: EnemyHitResult[];
  /** Sum of all enemy->player damage this round (after Defend halving is applied) - always equal
   *  to the sum of enemyHits[].damage; kept as its own field since most callers only need the
   *  aggregate. */
  damageTakenByPlayer: number;
  /** The player's ailments after this round's infliction rolls, cure-item use, and auto-expiry
   *  have all been applied - the caller (resolveCombatAction.ts) persists this verbatim onto
   *  CombatSession.playerAilments. */
  playerAilments: ActiveAilment[];
  /** Same as playerAilments, per enemy (same order/indices as enemyHp) - persisted onto
   *  CombatSession.enemies[i].ailments. */
  enemyAilments: ActiveAilment[][];
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
 *  every still-alive enemy, each rolling initiative (speed + d6, see rollInitiative below) and
 *  sorted descending - speed still dominates, but the roll gives round-to-round variance instead
 *  of a fully deterministic sort (ties, now rare, favor the player - the old tie-break rule).
 *  The player's single action can only target one enemy (attack/skill/lanternAbility); every other
 *  living enemy still gets its own
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
/** Flat chance for any enemy attack (boss or non-boss) to miss the player outright, rolled
 *  independently per attacker per round - previously enemy attacks always connected. Kept well
 *  under 0.5 deliberately: every balance test in this file mocks Math.random to exactly 0.5, so a
 *  chance below that never fires under test, leaving the existing deterministic round-by-round
 *  simulations (e.g. the 3-mothling group fight) unaffected by this addition. */
const ENEMY_MISS_CHANCE = 0.1;

/** Dampens each non-boss enemy's own attack damage based on how many non-boss enemies are
 *  currently alive (self-inclusive) - every alive enemy attacks every round while the player can
 *  only hit one target per turn, so without this an N-enemy fight is roughly N times harder than
 *  a 1-on-1 fight even though the underlying per-hit numbers are individually fair (verified
 *  numerically: undamped, a 3-enemy fight killed the player before they could even finish off the
 *  first enemy, at every player level). A boss's own attack is never dampened (see enemyAttack) -
 *  only its "adds" are, and only by how many adds are alive, so a boss fought alone or with 0-1
 *  adds is completely unaffected by this table. */
const CROWD_DAMAGE_FACTOR: Record<number, number> = { 1: 1, 2: 0.3, 3: 0.25, 4: 0.2, 5: 0.15, 6: 0.1 };

export function resolveRound(input: RoundInput): RoundResult {
  const { action } = input;
  const log: string[] = [];
  let playerHp = input.playerStats.hp;
  let playerSpirit = input.playerStats.spirit;
  let playerLanternOil = input.playerStats.lanternOil;
  let damageTakenByPlayer = 0;
  const itemConsumedIds: string[] = [];
  const hits: CombatHitResult[] = [];
  const enemyHits: EnemyHitResult[] = [];

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

  // Per-enemy mirror of the player ailment tracking just below - a player's Skill can now inflict
  // an ailment on an enemy the same way an enemy's own move inflicts one on the player, gated by
  // that enemy's own EnemyDefinition.vulnerableAilments allowlist (never the ailment it inflicts
  // itself - see that field's own doc comment). Copied rather than mutated in place, same reasoning
  // as the player's `ailments` below.
  const enemyAilments: ActiveAilment[][] = input.enemies.map((e) => e.ailments.map((a) => ({ ...a })));
  const inflictedThisRoundByEnemy: Set<string>[] = input.enemies.map(() => new Set());

  function inflictAilmentOnEnemy(i: number, ailmentId: string): boolean {
    if (!enemyDefs[i].vulnerableAilments.includes(ailmentId)) return false;
    if (!applyAilmentEntry(enemyAilments[i], ailmentId)) return false;
    inflictedThisRoundByEnemy[i].add(ailmentId);
    log.push(`${enemyDefs[i].name} is afflicted with ${AILMENTS[ailmentId].name}!`);
    return true;
  }

  /** Mirrors applyAilmentTickDamage below, for one enemy - called once per enemy per round, right
   *  at the point that enemy's own turn would occur (whether it actually attacked or was skipped
   *  by Stun), matching AilmentEffect's "dealt at the end of the afflicted character's own turn"
   *  contract. */
  function applyEnemyAilmentTickDamage(i: number) {
    if (!isAlive(i)) return;
    enemyHp[i] = applyAilmentTickDamageToTarget(
      enemyHp[i],
      enemyStats[i].maxHp,
      enemyAilments[i],
      log,
      enemyDefs[i].name,
      () => log.push(`${enemyDefs[i].name} is defeated!`),
    );
  }

  // The player's own ailment state (enemyAilments above is the parallel per-enemy version) -
  // copied rather than mutated in place so a caller that reuses `input` after calling resolveRound
  // never sees a half-mutated array. `inflictedThisRound` tracks ids inflicted during this same
  // round so the end-of-round expiry step (below) doesn't immediately decrement a fresh Stun to 0
  // before it
  // ever gets the chance to actually skip a turn.
  const ailments: ActiveAilment[] = input.playerAilments.map((a) => ({ ...a }));
  const inflictedThisRound = new Set<string>();
  const playerStunned = ailments.some((a) => a.ailmentId === 'stun');

  function inflictAilment(ailmentId: string) {
    const def = AILMENTS[ailmentId];
    if (!def) return;
    const existingIndex = ailments.findIndex((a) => a.ailmentId === ailmentId);
    // Omit turnsRemaining entirely rather than setting it to `undefined` - Firestore's Admin SDK
    // throws on an explicit `undefined` field value (`tx.update`/`tx.set` reject it outright), so
    // an ailment with no autoExpireAfterTurns (every one except Stun) crashed the whole
    // transaction the moment it was inflicted, surfacing to the client as a bare "internal" error.
    const entry: ActiveAilment =
      def.autoExpireAfterTurns === undefined ? { ailmentId } : { ailmentId, turnsRemaining: def.autoExpireAfterTurns };
    if (existingIndex >= 0) ailments[existingIndex] = entry;
    else ailments.push(entry);
    inflictedThisRound.add(ailmentId);
    log.push(`You are afflicted with ${def.name}!`);
  }

  /** Applied once, right as the player's own turn resolves (whichever branch that turns out to
   *  be - a normal action, a stunned no-op, or a flee attempt) - matches AilmentEffect's "dealt at
   *  the end of the afflicted character's own turn" contract for Poison/Burn/Freeze. */
  function applyAilmentTickDamage() {
    for (const active of ailments) {
      if (playerHp <= 0) break;
      const def = AILMENTS[active.ailmentId];
      if (!def?.effect.damagePercentPerTurn) continue;
      const dmg = Math.max(1, Math.round(input.playerStats.maxHp * def.effect.damagePercentPerTurn));
      playerHp = Math.max(0, playerHp - dmg);
      log.push(`${def.name} deals ${dmg} damage to you.`);
    }
  }

  // Burn's attackMultiplier is the only ailment effect that touches outgoing damage - multiple
  // stacked ailments with an attackMultiplier (none currently) would compound multiplicatively.
  const playerAttackMultiplier = ailments.reduce(
    (mult, a) => mult * (AILMENTS[a.ailmentId]?.effect.attackMultiplier ?? 1),
    1,
  );
  const playerBlindMissChance = blindMissChance(ailments);

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

    if (enemyAilments[i].some((a) => a.ailmentId === 'stun')) {
      log.push(`${def.name} is stunned and cannot move!`);
      return;
    }

    const enemyBlindChance = blindMissChance(enemyAilments[i]);
    if (enemyBlindChance > 0 && Math.random() < enemyBlindChance) {
      const missLogLine = `${def.name}'s attack goes wide - miss! (Blind)`;
      enemyHits.push({ attackerIndex: i, damage: 0, missed: true, wasDefended: false, logLine: missLogLine, damageType: 'physical' });
      log.push(missLogLine);
      return;
    }

    if (Math.random() < ENEMY_MISS_CHANCE) {
      const missLogLine = `${def.name}'s attack goes wide - miss!`;
      enemyHits.push({ attackerIndex: i, damage: 0, missed: true, wasDefended: false, logLine: missLogLine, damageType: 'physical' });
      log.push(missLogLine);
      return;
    }

    const hpFraction = enemyHp[i] / stats.maxHp;
    // Silence blocks this enemy's own signature move the same way it blocks the player's Skill
    // action - forced down to its plain 'attack' entry instead. Falls back to the unfiltered
    // moveset (never actually empty - 'attack' is in every enemy's moves) if somehow nothing
    // survives the filter.
    const isSilenced = enemyAilments[i].some((a) => AILMENTS[a.ailmentId]?.effect.blocksSkill);
    const moveSource = isSilenced ? { ...def, moves: def.moves.filter((m) => m.skillId === 'attack') } : def;
    const move = pickEnemyMove(moveSource.moves.length > 0 ? moveSource : def, hpFraction);
    const skill = SKILLS[move.skillId] ?? SKILLS.attack;
    const attackMultiplier = enemyAilments[i].reduce(
      (mult, a) => mult * (AILMENTS[a.ailmentId]?.effect.attackMultiplier ?? 1),
      1,
    );
    let dmg = computeDamage(skill.power, stats.attack * attackMultiplier, input.playerStats.defense);
    if (def.tier !== 'boss') {
      const crowdFactor = CROWD_DAMAGE_FACTOR[Math.min(6, aliveNonBossCount())] ?? 1;
      dmg = Math.max(1, Math.round(dmg * crowdFactor));
    }
    if (playerDefending) dmg = Math.round(dmg / 2);
    playerHp = Math.max(0, playerHp - dmg);
    damageTakenByPlayer += dmg;
    const attackLogLine = `${def.name} uses ${move.skillId.replace(/-/g, ' ')} for ${dmg} damage${
      playerDefending ? ' (halved - you defended)' : ''
    }.`;
    const enemyHit: EnemyHitResult = {
      attackerIndex: i,
      damage: dmg,
      missed: false,
      wasDefended: playerDefending,
      logLine: attackLogLine,
      damageType: skill.damageType,
    };
    enemyHits.push(enemyHit);
    log.push(attackLogLine);

    // Only rolled once the attack itself has already landed (see Skill.inflictAilmentChance's doc
    // comment) - a missed attack (the branch above, which returns early) never reaches here. The
    // player's equipped-item resistance (see equipmentEngine.ts's computeAilmentResistances)
    // reduces the effective chance - a no-op today since no authored item sets it yet.
    if (
      skill.inflictsAilmentId &&
      Math.random() < applyAilmentResistance(skill.inflictAilmentChance ?? 0, skill.inflictsAilmentId, input.ailmentResistances)
    ) {
      inflictAilment(skill.inflictsAilmentId);
      enemyHit.ailmentInflicted = skill.inflictsAilmentId;
    }
  }

  /** 1.5x, matching the existing effectiveAgainstFamilies bonus's value, when the move's own
   *  damageType matches this enemy's authored weaknessDamageType (data/enemies.ts) - shared by all
   *  three offensive action types so "bring the right damage type" is a real, consistent incentive
   *  rather than something only lantern abilities' family-effectiveness bonus rewarded before. */
  function weaknessMultiplier(enemyIdx: number, damageType: DamageType): number {
    return enemyDefs[enemyIdx].weaknessDamageType === damageType ? 1.5 : 1;
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
   *  single-target behavior (no reduction, no miss) once only one enemy remains.
   *
   *  `damageType` is always passed explicitly by every call site today (attack: 'physical', skill:
   *  whatever the Skill entry says, lanternAbility: 'lantern') - the 'physical' default only
   *  matters if a future call site omits it. Blind's accuracy penalty only ever applies when it's
   *  'physical', per its "reduced physical-attack accuracy" spec. */
  function resolveOffensiveHits(
    power: number,
    verb: string,
    bonusMultiplier: (enemyIdx: number) => number = () => 1,
    damageType: DamageType = 'physical',
    // Mirrors Skill.inflictsAilmentId/inflictAilmentChance - only a couple of quest-taught Skills
    // set this today (frost-lance/ember-burst), same as only an enemy's own signature move sets it
    // on the enemy->player side. Rolled once per landed (non-missed) hit, same "only after the
    // attack itself already connected" rule enemyAttack's own ailment roll follows.
    ailment?: { id: string; chance: number },
  ) {
    const alive = aliveIndices();
    const useAll = !!action.targetAll && alive.length > 1;
    const targets = useAll ? alive : [resolveTargetIndex()].filter((i): i is number => i !== undefined);
    const blindApplies = damageType === 'physical' && playerBlindMissChance > 0;

    for (const i of targets) {
      const missedTargetAll = useAll && Math.random() < TARGET_ALL_MISS_CHANCE;
      const missedBlind = blindApplies && Math.random() < playerBlindMissChance;
      if (missedTargetAll || missedBlind) {
        log.push(`Your attack on ${enemyDefs[i].name} goes wide - miss!${missedBlind ? ' (Blind)' : ''}`);
        hits.push({ targetIndex: i, damage: 0, missed: true, defeated: false, damageType });
        continue;
      }
      let dmg = Math.round(
        computeDamage(power, input.playerStats.attack * playerAttackMultiplier, enemyStats[i].defense) * bonusMultiplier(i),
      );
      if (useAll) dmg = Math.max(1, Math.round(dmg * TARGET_ALL_DAMAGE_FACTOR));
      const defeated = damageEnemy(i, dmg, verb);
      const hit: CombatHitResult = { targetIndex: i, damage: dmg, missed: false, defeated, damageType };
      hits.push(hit);
      if (ailment && !defeated && Math.random() < ailment.chance && inflictAilmentOnEnemy(i, ailment.id)) {
        hit.ailmentInflicted = ailment.id;
      }
    }
  }

  function consumeItems(itemIds: string[]) {
    for (const [itemId, count] of aggregateItemCounts(itemIds)) {
      const def = ITEMS[itemId];
      if (!def?.effect) continue;
      for (let n = 0; n < count; n++) itemConsumedIds.push(itemId);

      // Cure items only ever clear one ailment and do nothing else - a repeat use once the
      // ailment is already gone (e.g. 2x Antidote queued for a single Poison) is simply a no-op
      // for the second one, not an error (resolveCombatAction.ts's wouldHaveEffect check is what
      // stops this from being requested in the first place).
      if (def.effect.cureAilmentId) {
        const cureId = def.effect.cureAilmentId;
        const idx = ailments.findIndex((a) => a.ailmentId === cureId);
        if (idx >= 0) {
          const curedName = AILMENTS[cureId]?.name ?? cureId;
          ailments.splice(idx, 1);
          log.push(`You use ${itemId.replace(/-/g, ' ')} and cure ${curedName}.`);
        }
      }

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
        if (def.effect.restoreOilPercent) {
          const before = playerLanternOil;
          const amount = Math.round(input.playerStats.maxLanternOil * def.effect.restoreOilPercent);
          playerLanternOil = Math.min(input.playerStats.maxLanternOil, playerLanternOil + amount);
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
        resolveOffensiveHits(SKILLS.attack.power, 'You strike', (i) => weaknessMultiplier(i, 'physical'), 'physical', input.attackAilment);
        break;
      case 'skill': {
        const skill = SKILLS[action.skillId ?? 'keepers-strike'];
        playerSpirit = Math.max(0, playerSpirit - skill.spiritCost);
        resolveOffensiveHits(
          skill.power,
          "Keeper's Strike hits",
          (i) => weaknessMultiplier(i, skill.damageType),
          skill.damageType,
          skill.inflictsAilmentId ? { id: skill.inflictsAilmentId, chance: skill.inflictAilmentChance ?? 0 } : undefined,
        );
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
            (i) =>
              (ability.effectiveAgainstFamilies?.includes(enemyDefs[i].family) ? 1.5 : 1) *
              weaknessMultiplier(i, 'lantern'),
            'lantern',
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

  /** Attacks every still-living enemy in the given indices, speed-sorted - the enemies' half of a
   *  round where the player's own turn was replaced by a Stun no-op (see below), factored out
   *  from the normal turn-order loop since Stun bypasses the player entirely rather than taking a
   *  (do-nothing) slot within it. */
  function attackAllInSpeedOrder(indices: number[]) {
    const sorted = [...indices].sort((a, b) => enemyStats[b].speed - enemyStats[a].speed);
    for (const i of sorted) {
      if (playerHp <= 0) break;
      if (isAlive(i)) {
        enemyAttack(i);
        applyEnemyAilmentTickDamage(i);
      }
    }
  }

  if (playerStunned) {
    // Stun skips the entire turn - action, items, everything (see AilmentEffect.skipsTurn) - so
    // consumeItems() is deliberately never called on this branch.
    log.push('You are stunned and cannot act!');
    applyAilmentTickDamage();
    attackAllInSpeedOrder(aliveIndices());
  } else {
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
        // A successful flee still resolves the player's own turn, so lingering Poison/Burn/Freeze
        // damage applies here too (see applyAilmentTickDamage's own doc comment) - this early
        // return previously skipped it, the one branch of the three that did.
        applyAilmentTickDamage();
        return {
          log,
          playerHp,
          playerSpirit,
          playerLanternOil,
          enemyHp,
          // Vanishingly rare, but consistent with how the rest of this function treats it: dying to
          // that same tick damage while fleeing is a defeat, not an escape.
          phase: playerHp <= 0 ? 'defeat' : 'fled',
          itemConsumedIds,
          hits,
          enemyHits,
          damageTakenByPlayer,
          playerAilments: ailments,
          enemyAilments,
        };
      }
      log.push('You try to flee, but there is no opening! Every foe still standing gets a free hit.');
      applyAilmentTickDamage();
      for (const i of alive) {
        enemyAttack(i);
        applyEnemyAilmentTickDamage(i);
      }
    } else {
      // Initiative = speed + a d6 roll, re-rolled every round - keeps speed the dominant factor
      // (a big enough lead still reliably goes first) while giving turn order genuine round-to-
      // round variance instead of the old fully-deterministic sort. Stable sort keeps the player
      // (listed first) ahead of any enemy that rolls the exact same total.
      function rollInitiative(speed: number): number {
        return speed + (1 + Math.floor(Math.random() * 6));
      }
      type Turn = { kind: 'player'; roll: number } | { kind: 'enemy'; index: number; roll: number };
      const alive = aliveIndices();
      const turns: Turn[] = [
        { kind: 'player', roll: rollInitiative(input.playerStats.speed) },
        ...alive.map((i): Turn => ({ kind: 'enemy', index: i, roll: rollInitiative(enemyStats[i].speed) })),
      ];
      turns.sort((a, b) => b.roll - a.roll);

      for (const turn of turns) {
        if (playerHp <= 0) break;
        if (turn.kind === 'player') {
          playerTurn();
          applyAilmentTickDamage();
        } else if (isAlive(turn.index)) {
          enemyAttack(turn.index);
          applyEnemyAilmentTickDamage(turn.index);
        }
      }
    }
  }

  // End-of-round ailment expiry - anything inflicted THIS round is left untouched (see
  // inflictedThisRound's doc comment above) so a fresh Stun actually blocks the player's next
  // turn instead of expiring before it ever takes effect.
  const remainingAilments = ailments
    .map((a) =>
      a.turnsRemaining === undefined || inflictedThisRound.has(a.ailmentId) ? a : { ...a, turnsRemaining: a.turnsRemaining - 1 },
    )
    .filter((a) => a.turnsRemaining === undefined || a.turnsRemaining > 0);

  // Same expiry rule, per enemy.
  const remainingEnemyAilments = enemyAilments.map((list, i) =>
    list
      .map((a) =>
        a.turnsRemaining === undefined || inflictedThisRoundByEnemy[i].has(a.ailmentId)
          ? a
          : { ...a, turnsRemaining: a.turnsRemaining - 1 },
      )
      .filter((a) => a.turnsRemaining === undefined || a.turnsRemaining > 0),
  );

  const allDefeated = enemyHp.every((hp) => hp <= 0);
  let phase: RoundOutcomePhase = 'continue';
  if (allDefeated) phase = 'victory';
  else if (playerHp <= 0) phase = 'defeat';

  return {
    log,
    playerHp,
    playerSpirit,
    playerLanternOil,
    enemyHp,
    phase,
    itemConsumedIds,
    hits,
    enemyHits,
    damageTakenByPlayer,
    playerAilments: remainingAilments,
    enemyAilments: remainingEnemyAilments,
  };
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
  /** True to skip this enemy's lootTable roll entirely - used for a boss already defeated before
   *  this fight (being refought): xp/gold still pay out normally, but its guaranteed/special item
   *  drops don't repeat. Explicit rather than relying on those items happening to be marked
   *  `unique: true` (which stops a *duplicate* grant, but doesn't stop the roll/log from firing,
   *  and wouldn't protect a future boss drop that isn't marked unique). */
  skipLoot?: boolean;
}

/** Sums xp/gold/loot across every enemy defeated in the fight (called once, at full-clear
 *  victory, with the complete roster - not incrementally per kill). xp/gold are each enemy's
 *  authored xpReward/goldReward as-is - not scaled by the enemy's rolled level (unlike its
 *  stats), so progression comes from later regions authoring higher payouts, not from the same
 *  enemy paying out more just because it happened to roll a higher level against a higher-level
 *  player. */
export function computeRewards(defeated: DefeatedEnemy[], currentXp: number, currentLevel: number): RewardResult {
  const lootItemIds: string[] = [];
  let totalXp = 0;
  let totalGold = 0;

  for (const { enemyId, skipLoot } of defeated) {
    const enemy = ENEMIES[enemyId];
    totalXp += enemy.xpReward;
    totalGold += enemy.goldReward;
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

export interface VictoryRestore {
  stat: 'hp' | 'spirit' | 'lanternOil';
  amount: number;
}

const VICTORY_RESTORE_CHANCE = 0.25;
const VICTORY_RESTORE_PERCENT = 0.15;

/** A small, chance-based bonus on top of the usual xp/gold/loot - "some battles" (not every one)
 *  leave the player a little restored, never exceeding any stat's max. Only rolls among stats that
 *  aren't already at max, so this is a no-op (never fires) at full health/spirit/oil, and
 *  naturally excludes lanternOil when no lantern is equipped (maxLanternOil is 0 there, so 0 < 0
 *  is false - no special-casing needed). */
export function rollVictoryRestore(stats: Stats): VictoryRestore | null {
  const all: { stat: VictoryRestore['stat']; max: number }[] = [
    { stat: 'hp', max: stats.maxHp },
    { stat: 'spirit', max: stats.maxSpirit },
    { stat: 'lanternOil', max: stats.maxLanternOil },
  ];
  const eligible = all.filter(({ stat, max }) => stats[stat] < max);
  if (eligible.length === 0 || Math.random() >= VICTORY_RESTORE_CHANCE) return null;
  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  return { stat: pick.stat, amount: Math.round(pick.max * VICTORY_RESTORE_PERCENT) };
}
