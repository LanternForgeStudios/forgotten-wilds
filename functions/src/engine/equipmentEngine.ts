import { EQUIPMENT, type StatBonuses } from '../data/equipment';
import type { AilmentResistance, PlayerEquipment, PlayerSave, Stats } from '../shared-types';

/** The full, empty equipment shape every PlayerSave should have - the single source of truth for
 *  backfillPlayerEquipment below and every other call site that used to hand-roll this same
 *  literal (endlessBattle.ts, pvpBattle.ts, resolveCombatAction.ts) before the 'armor'->'chest'
 *  rename/'legs' addition made keeping N independent copies in sync too risky. */
export function freshPlayerEquipment(): PlayerEquipment {
  return { weapon: null, chest: null, legs: null, boots: null, gloves: null, charm: null, lantern: null, spiritTotem: null };
}

/** Backfill for a save written before the equipment system existed - player.equipment is entirely
 *  absent from the Firestore doc for these, not just empty, so any unguarded `save.player.
 *  equipment.X` read throws a bare INTERNAL error. Matches buildFreshPlayer's own defaults
 *  (newCharacter.ts). Every Cloud Function that reads a PlayerSave's equipment must call this
 *  first, on that save, before touching it - centralized here (rather than each call site
 *  duplicating the same object literal) specifically so a new call site can't reintroduce this
 *  crash by forgetting to copy it; a prior version of this fix shipped as four separate inline
 *  copies and still missed six other real call sites (equipItem/unequipItem/sellItem/trade.ts,
 *  and partyBattle.ts's restoreParticipantsAndClearLocks/restoreAndRewardPvpParticipants). Also
 *  the one place that migrates a pre-rename save's 'armor' key to 'chest' and backfills 'legs'
 *  for any save that predates that slot - see the two migration steps below. */
export function backfillPlayerEquipment(save: PlayerSave): void {
  if (!save.player.equipment) {
    save.player.equipment = freshPlayerEquipment();
    return;
  }
  // Migrates a save written before the 'armor'->'chest' rename - the old key would otherwise sit
  // orphaned (nothing reads it anymore) and silently drop whatever the player had equipped there.
  const legacy = save.player.equipment as PlayerEquipment & { armor?: string | null };
  if (legacy.armor !== undefined && legacy.chest === undefined) {
    legacy.chest = legacy.armor;
    delete legacy.armor;
  }
  // Backfills the new 'legs' slot for any save (old or freshly migrated above) that predates it.
  if (legacy.legs === undefined) {
    legacy.legs = null;
  }
}

/** Mutates stats in place, applying (sign=1) or removing (sign=-1) an item's bonuses, clamping current
 *  hp/spirit so they never exceed the resulting max after the change. */
export function adjustStatsForBonuses(stats: Stats, bonuses: StatBonuses, sign: 1 | -1): void {
  if (bonuses.maxHp) stats.maxHp = Math.max(1, stats.maxHp + sign * bonuses.maxHp);
  if (bonuses.maxSpirit) stats.maxSpirit = Math.max(0, stats.maxSpirit + sign * bonuses.maxSpirit);
  if (bonuses.attack) stats.attack = Math.max(0, stats.attack + sign * bonuses.attack);
  if (bonuses.defense) stats.defense = Math.max(0, stats.defense + sign * bonuses.defense);
  if (bonuses.speed) stats.speed = Math.max(0, stats.speed + sign * bonuses.speed);

  stats.hp = Math.min(stats.hp, stats.maxHp);
  stats.spirit = Math.min(stats.spirit, stats.maxSpirit);
}

/** Resolves the equipped weapon's attackAilment (see EquipmentDefinition) into the plain
 *  {id,chance} shape resolveOffensiveHits/resolveOffensiveHit already expect for a Skill's own
 *  inflictsAilmentId - callers (resolveCombatAction.ts, partyBattle.ts) resolve this once from the
 *  save/snapshot and pass the plain value into the engine, rather than the engine importing
 *  EQUIPMENT itself, so combatEngine.ts/partyCombatEngine.ts stay decoupled from equipment data
 *  the same way they already are from it today. Undefined whenever no weapon is equipped or the
 *  equipped one doesn't set attackAilment - always undefined right now, since no authored weapon
 *  does yet. */
export function resolveWeaponAttackAilment(weaponId: string | null | undefined): { id: string; chance: number } | undefined {
  const attackAilment = weaponId ? EQUIPMENT[weaponId]?.attackAilment : undefined;
  return attackAilment ? { id: attackAilment.ailmentId, chance: attackAilment.chance } : undefined;
}

/** Flattens every equipped item's ailmentResistance entries (see EquipmentDefinition) into one
 *  list, ready for combatMath.ts's applyAilmentResistance. Always [] today since no authored item
 *  sets ailmentResistance yet. */
export function computeAilmentResistances(equipment: PlayerEquipment): AilmentResistance[] {
  return Object.values(equipment)
    .filter((id): id is string => !!id)
    .flatMap((id) => EQUIPMENT[id]?.ailmentResistance ?? []);
}

/** Unlike the generic stat bonuses above (which stack additively across several equipped slots),
 *  only one lantern can ever be equipped at a time, so its oil capacity fully *replaces* the
 *  previous value rather than adding to it. Current oil clamps down if the new capacity is lower -
 *  swapping lanterns is not a way to top off for free. */
export function setLanternOilCapacity(stats: Stats, oilCapacity: number): void {
  stats.maxLanternOil = Math.max(0, oilCapacity);
  stats.lanternOil = Math.min(stats.lanternOil, stats.maxLanternOil);
}
