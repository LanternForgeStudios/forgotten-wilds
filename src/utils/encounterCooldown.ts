/** Seconds a player is ineligible to trigger another random encounter after the last one ended -
 *  prevents rapid back-to-back random fights while walking through an encounter zone. Deliberately
 *  a module-level timestamp rather than a Zustand store: it's pure client-side pacing with no
 *  server component (unlike every other piece of persisted game state) and needs to survive
 *  Overworld/DungeonScene unmounting and remounting on the way back from combat, which a
 *  component-local useState/useRef wouldn't. Doesn't apply to boss encounters - those are
 *  triggered by walking up to a boss's interactable object, a separate code path from the random
 *  encounter-zone roll this guards. */
const ENCOUNTER_COOLDOWN_MS = 7000;

let lastEncounterEndedAt = 0;

/** Call once whenever a combat encounter concludes (victory/defeat/fled/error), regardless of
 *  outcome, right before navigating back to exploration. */
export function markEncounterEnded(): void {
  lastEncounterEndedAt = Date.now();
}

/** Checked before rolling a random encounter - true means the player is still in the cooldown
 *  window and the roll should be skipped entirely. */
export function isEncounterCooldownActive(): boolean {
  return Date.now() - lastEncounterEndedAt < ENCOUNTER_COOLDOWN_MS;
}
