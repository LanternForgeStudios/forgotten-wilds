/** Front row holds up to 3; anything beyond that overflows to a staggered back row - mirrors how
 *  most JRPGs lay out a 1-6 enemy group rather than a single line. A boss fight is a special case:
 *  the boss always sits in the back row with its 0-3 "adds" (never more than 3, so they always fit
 *  the front row) in front, regardless of position in the array - not the same positional split a
 *  same-tier group of 4-6 regular/elite enemies uses. Moved here (from CombatScene.tsx) since only
 *  BattleScene needs front/back once enemy rendering itself moved to Phaser. Generic over any
 *  shape with `isBoss` rather than tied to a specific enemy type, since BattleScene's own
 *  BattleEnemyVisual shape (not CombatScene's EncounterEnemy) is what actually calls this. */
export function splitFormation<T extends { isBoss: boolean }>(items: T[]): { front: T[]; back: T[] } {
  if (items.some((e) => e.isBoss)) {
    return { front: items.filter((e) => !e.isBoss), back: items.filter((e) => e.isBoss) };
  }
  const front = items.slice(0, 3);
  const back = items.slice(3);
  return { front, back };
}
