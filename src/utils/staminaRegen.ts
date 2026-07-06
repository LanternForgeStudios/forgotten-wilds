/** How many seconds a full empty-to-max Stamina refill takes - display-only copy of the same
 *  constant in functions/src/functions/dash.ts, kept in sync by hand like any other client/server
 *  display number. Used to interpolate the HUD's Stamina bar between server round-trips so it
 *  visibly climbs in real time instead of only updating right after a Dash. */
export const FULL_REGEN_SECONDS = 20;

/** Predicted current Stamina, extrapolated from the last server-confirmed value and timestamp.
 *  Display-only - never written anywhere; the next Dash call recomputes the real value itself
 *  from the same staminaUpdatedAt, so this can never drift the actual game state, only how far
 *  ahead of the last server response the bar visually shows between round-trips. */
export function predictedStamina(stamina: number, maxStamina: number, staminaUpdatedAt: number, now: number): number {
  if (maxStamina <= 0) return 0;
  const elapsedSeconds = Math.max(0, (now - staminaUpdatedAt) / 1000);
  const regenPerSecond = maxStamina / FULL_REGEN_SECONDS;
  return Math.min(maxStamina, stamina + elapsedSeconds * regenPerSecond);
}
