/** Mirrors the server's AilmentEffect (functions/src/data/ailments.ts) exactly - the client never
 *  computes combat math from this (the server always re-validates every gated action), but
 *  CombatScene reads the boolean flags to pre-disable a button before a wasted round-trip, the
 *  same way src/utils/itemEffect.ts's ItemEffect mirror already does for items. */
export interface AilmentEffect {
  damagePercentPerTurn?: number;
  attackMultiplier?: number;
  physicalAccuracyMultiplier?: number;
  skipsTurn?: boolean;
  disablesLanternAbility?: boolean;
  blocksSkill?: boolean;
}

/** Display copy plus the mechanical flags above - the actual damage/turn resolution still only
 *  ever happens server-side (functions/src/data/ailments.ts), this is just close enough for the
 *  client to show a name/icon/description and pre-gate UI without waiting on a round-trip. */
export interface AilmentDefinition {
  id: string;
  name: string;
  description: string;
  iconAssetId: string;
  effect: AilmentEffect;
}

/** One ailment currently affecting the player mid-battle - part of a resolveCombatAction/
 *  startEncounter response, mirrors the server's ActiveAilment (shared-types/index.ts). */
export interface ActiveAilment {
  ailmentId: string;
  /** Turns remaining before this auto-expires - undefined for a "until cured or battle ends"
   *  ailment (see AilmentDefinition.autoExpireAfterTurns server-side). */
  turnsRemaining?: number;
}

/** Mirrors the server's AilmentResistance (shared-types/index.ts) - display copy only. */
export interface AilmentResistance {
  ailmentId: string;
  reductionPercent: number;
}
