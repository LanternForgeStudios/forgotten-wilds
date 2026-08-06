import { EQUIPMENT, type EquipmentDefinition, type StatBonuses } from '../data/equipment';
import { LANTERN_OIL_UPGRADE_PER_TIER } from '../data/lanternOilUpgrades';
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
  } else {
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
  // Backfill for a save written before Lantern Oil upgrades existed - see PlayerSave's own doc
  // comment on lanternOilUpgrades. Centralized here (not a per-call-site one-liner, unlike
  // knownSkillIds' scattered pattern) since every equip/unequip/upgrade call site already calls
  // this function first.
  if (!save.player.lanternOilUpgrades) save.player.lanternOilUpgrades = {};
}

/** A lantern's real max Oil capacity: its authored base oilCapacity plus whatever permanent
 *  upgrade tier the player has bought for THIS SPECIFIC lantern id (see
 *  data/lanternOilUpgrades.ts) - independent of which lantern happens to be equipped right now. */
export function effectiveOilCapacity(baseOilCapacity: number, lanternId: string, upgrades: Record<string, number> | undefined): number {
  return baseOilCapacity + (upgrades?.[lanternId] ?? 0) * LANTERN_OIL_UPGRADE_PER_TIER;
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

/** Applies itemId's stat bonuses (and lantern-oil capacity, if it's a lantern) and assigns it into
 *  its own def.slot - the shared "how to equip an item" step used both by equipItem.ts (which
 *  strips the previous occupant's bonuses first via adjustStatsForBonuses(...,-1), if any, before
 *  calling this) and questEngine.ts's autoEquip reward path (which only ever acts on an already-
 *  empty slot, so there's nothing to strip first). Centralized so the two call sites can't drift
 *  the way autoEquip's own inline `equipment[slot] = itemId` once did - it set the slot without
 *  ever applying the item's stat bonuses, so a quest-granted item showed as equipped but its
 *  bonuses were silently never added to the player's stats. */
export function equipIntoSlot(save: PlayerSave, itemId: string, def: EquipmentDefinition): void {
  adjustStatsForBonuses(save.player.stats, def.statBonuses, 1);
  if (def.slot === 'lantern') {
    setLanternOilCapacity(save.player.stats, effectiveOilCapacity(def.oilCapacity ?? 0, itemId, save.player.lanternOilUpgrades));
  }
  save.player.equipment[def.slot] = itemId;
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
 *  list, ready for combatMath.ts's applyAilmentResistance. [] whenever nothing equipped grants a
 *  resistance - real content does now (Crimson Bayou's mire-gloves/bayou-charm Rare tiers vs.
 *  Poison, Iron Mountains' mountain-charm/work-gloves Rare tiers vs. Burn). */
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
