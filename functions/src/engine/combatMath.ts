// Shared pure combat math - used by both combatEngine.ts (solo quest combat) and
// partyCombatEngine.ts (the Multiplayer Battle System's party/PvP combat, see
// docs/NewClaudeAsk.txt's "Multiplayer Battle System Design"). Extracted here specifically so the
// two engines can never silently drift on how a hit or an enemy's move choice is computed -
// combatEngine.ts imports these instead of defining its own copies (verified by its own test
// suite, which is unchanged by this extraction).

import { AILMENTS } from '../data/ailments';
import type { EnemyDefinition, EnemyMove } from '../data/enemies';
import type { ActiveAilment } from '../shared-types';

/** Picks one item from `items`, proportional to `weightOf(item)`. Callers are expected to only
 *  ever pass a non-empty `items` array. */
export function weightedPick<T>(items: T[], weightOf: (item: T) => number): T {
  const totalWeight = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = Math.random() * totalWeight;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[0];
}

export function computeDamage(power: number, attackerAtk: number, defenderDef: number): number {
  const base = power + attackerAtk * 0.5 - defenderDef * 0.5;
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.round(base * variance));
}

/** Picks a weighted move from `enemy.moves`, respecting each move's HP-gated availability
 *  (`unlocksAtHpFraction`) - `=== undefined`, not a falsy check, so an authored threshold of
 *  exactly 0 ("only once nearly dead") isn't treated as "no threshold at all." Falls back to the
 *  enemy's first move if every move is HP-gated above the current threshold (a content bug -
 *  every authored enemy has at least one unconditional move) rather than returning undefined. */
export function pickEnemyMove(enemy: EnemyDefinition, hpFraction: number): EnemyMove {
  const available = enemy.moves.filter((m) => m.unlocksAtHpFraction === undefined || hpFraction <= m.unlocksAtHpFraction);
  if (available.length === 0) return enemy.moves[0];
  return weightedPick(available, (m) => m.weight);
}

/** Player-side ailment infliction ("You are afflicted..." - 2nd person) - operates on one
 *  combatant's ailment array at a time, so the party engine can call it once per player per round
 *  the same way the solo engine calls it once for its one player. Enemies can be afflicted too now
 *  (see EnemyDefinition.vulnerableAilments), but go through each engine's own inflictAilmentOnEnemy
 *  instead of this function, since that needs a vulnerability check and 3rd-person log phrasing
 *  this shared helper doesn't have. Copies rather than mutates in place, matching the solo engine's
 *  own contract. */
export function inflictAilment(ailments: ActiveAilment[], ailmentId: string, log: string[]): ActiveAilment[] {
  const def = AILMENTS[ailmentId];
  if (!def) return ailments;
  const next = ailments.map((a) => ({ ...a }));
  const existingIndex = next.findIndex((a) => a.ailmentId === ailmentId);
  // Omit turnsRemaining entirely rather than `undefined` - Firestore's Admin SDK rejects an
  // explicit undefined field value outright.
  const entry: ActiveAilment =
    def.autoExpireAfterTurns === undefined ? { ailmentId } : { ailmentId, turnsRemaining: def.autoExpireAfterTurns };
  if (existingIndex >= 0) next[existingIndex] = entry;
  else next.push(entry);
  log.push(`You are afflicted with ${def.name}!`);
  return next;
}

/** Poison/Burn/Freeze's per-turn damage, applied once as the afflicted combatant's own turn
 *  resolves - returns the new hp (clamped at 0) and pushes one log line per ailment that ticked. */
export function applyAilmentTickDamage(hp: number, maxHp: number, ailments: ActiveAilment[], log: string[]): number {
  let next = hp;
  for (const active of ailments) {
    if (next <= 0) break;
    const def = AILMENTS[active.ailmentId];
    if (!def?.effect.damagePercentPerTurn) continue;
    const dmg = Math.max(1, Math.round(maxHp * def.effect.damagePercentPerTurn));
    next = Math.max(0, next - dmg);
    log.push(`${def.name} deals ${dmg} damage to you.`);
  }
  return next;
}

/** Burn's attackMultiplier is the only ailment effect that touches outgoing damage today -
 *  multiple stacked ailments with an attackMultiplier would compound multiplicatively. */
export function ailmentAttackMultiplier(ailments: ActiveAilment[]): number {
  return ailments.reduce((mult, a) => mult * (AILMENTS[a.ailmentId]?.effect.attackMultiplier ?? 1), 1);
}

/** Blind's reduced physical-attack accuracy, expressed as a miss chance (0 if not blinded). */
export function blindMissChance(ailments: ActiveAilment[]): number {
  return ailments.some((a) => a.ailmentId === 'blind') ? 1 - (AILMENTS.blind.effect.physicalAccuracyMultiplier ?? 1) : 0;
}

/** End-of-round ailment expiry - anything inflicted THIS round (tracked by the caller via
 *  `inflictedThisRound`) is left untouched so a fresh Stun actually blocks the *next* turn instead
 *  of expiring before it ever takes effect. */
export function expireAilments(ailments: ActiveAilment[], inflictedThisRound: Set<string>): ActiveAilment[] {
  return ailments
    .map((a) =>
      a.turnsRemaining === undefined || inflictedThisRound.has(a.ailmentId) ? a : { ...a, turnsRemaining: a.turnsRemaining - 1 },
    )
    .filter((a) => a.turnsRemaining === undefined || a.turnsRemaining > 0);
}

export function isStunned(ailments: ActiveAilment[]): boolean {
  return ailments.some((a) => a.ailmentId === 'stun');
}

/** Initiative = speed + a d6 roll, re-rolled every round - keeps speed the dominant factor while
 *  giving turn order genuine round-to-round variance instead of a fully deterministic sort. */
export function rollInitiative(speed: number): number {
  return speed + (1 + Math.floor(Math.random() * 6));
}
