/** Display-only shape - the mechanical effect (damage/turn, attack multiplier, etc.) lives only
 *  server-side (functions/src/data/ailments.ts) since nothing on the client needs to compute it,
 *  only show a name/icon/description for whichever ailments a battle response reports active. */
export interface AilmentDefinition {
  id: string;
  name: string;
  description: string;
  iconAssetId: string;
}

/** One ailment currently affecting the player mid-battle - part of a resolveCombatAction/
 *  startEncounter response, mirrors the server's ActiveAilment (shared-types/index.ts). */
export interface ActiveAilment {
  ailmentId: string;
  /** Turns remaining before this auto-expires - undefined for a "until cured or battle ends"
   *  ailment (see AilmentDefinition.autoExpireAfterTurns server-side). */
  turnsRemaining?: number;
}
