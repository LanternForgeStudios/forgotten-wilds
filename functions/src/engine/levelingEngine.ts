import { levelForXp, STAT_GROWTH_PER_LEVEL } from '../data/leveling';
import type { PlayerSave } from '../shared-types';

/** Recomputes level from the player's current xp and, if it increased, applies stat growth for
 *  every level gained (handles multi-level jumps from a single large xp grant correctly, since
 *  levelForXp always resolves to the right level regardless of how far past a threshold xp sits).
 *  Safe to call repeatedly in the same request (e.g. once after combat xp, again inside
 *  applyQuestRewards) - a no-op once save.player.level already matches levelForXp(xp).
 *
 *  This is the single place level-up is ever applied - every xp-granting call site (combat
 *  rewards, quest rewards) must route through it, or a level-up from that source silently never
 *  happens (this used to be combat-only, inlined in resolveCombatAction.ts, which is exactly why
 *  quest-reward xp alone never triggered a level-up before). */
export function applyLevelUp(save: PlayerSave): void {
  const newLevel = levelForXp(save.player.xp);
  if (newLevel <= save.player.level) return;

  const levelsGained = newLevel - save.player.level;
  save.player.level = newLevel;
  save.player.stats.maxHp += STAT_GROWTH_PER_LEVEL.maxHp * levelsGained;
  save.player.stats.maxSpirit += STAT_GROWTH_PER_LEVEL.maxSpirit * levelsGained;
  // Stays untouched at 0 until Stamina is unlocked (interactWithShrine.ts grants the base pool,
  // already scaled for the player's current level, the moment that happens).
  if (save.player.stats.maxStamina > 0) {
    save.player.stats.maxStamina += STAT_GROWTH_PER_LEVEL.maxStamina * levelsGained;
    save.player.stats.stamina = Math.min(save.player.stats.stamina, save.player.stats.maxStamina);
  }
  save.player.stats.attack += STAT_GROWTH_PER_LEVEL.attack * levelsGained;
  save.player.stats.defense += STAT_GROWTH_PER_LEVEL.defense * levelsGained;
  save.player.stats.speed += STAT_GROWTH_PER_LEVEL.speed * levelsGained;
  save.player.stats.hp = save.player.stats.maxHp;
  save.player.stats.spirit = save.player.stats.maxSpirit;
}
