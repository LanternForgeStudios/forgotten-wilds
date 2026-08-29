import type { SunPosition, TimePhase } from '@/types';

/** Total real-world duration of one full day/night cycle - a single tunable. 24 real minutes means
 *  6 minutes per phase, so a normal 20-30 minute play session sees most or all of a cycle at least
 *  once, without it feeling like the sky is flickering. */
export const CYCLE_DURATION_MS = 24 * 60 * 1000;

const PHASE_ORDER: TimePhase[] = ['day', 'sunset', 'night', 'sunrise'];

/** Pure function of wall-clock time - every client computes the same phase for the same instant,
 *  no persistence or server round-trip needed (same "client-only, resolved fresh" shape as
 *  src/utils/weather.ts's resolveWeather, just with no location/quest input at all - this is a
 *  single shared world clock, not per-location). */
export function resolveTimePhase(now: number = Date.now()): TimePhase {
  const phaseDuration = CYCLE_DURATION_MS / 4;
  const index = Math.floor(now / phaseDuration) % 4;
  return PHASE_ORDER[index];
}

/** The midpoint instant of a given phase, in the same cycle-relative space `resolveSunPosition`
 *  reads - used when a caller has only a discrete phase (e.g. the Debug tab's Auto/Day/Sunrise/
 *  Sunset/Night quick-pick buttons) and needs *some* concrete sun position to go with it. Picking
 *  the phase's midpoint rather than its start avoids a jarring near-horizon shadow for a "Day"
 *  override, which should read as ordinary daytime (near solar noon), not the instant day begins. */
export function representativeCycleTime(phase: TimePhase): number {
  const phaseDuration = CYCLE_DURATION_MS / 4;
  return PHASE_ORDER.indexOf(phase) * phaseDuration + phaseDuration / 2;
}

/** Continuous sun position for cast-shadow rotation/length (see SunPosition's own doc comment) -
 *  a pure function of the same wall-clock cycle `resolveTimePhase` reads, so the two always agree
 *  on which phase a given instant is in. Chronological order within one cycle is day -> sunset ->
 *  night -> sunrise -> day (PHASE_ORDER's index order) - the sun is above the horizon for 3
 *  contiguous quarters (sunrise -> day -> sunset) and below it for the 4th (night), so this maps
 *  that 3-quarter arc onto a continuous 0..1 "how far through being visible" progress, wrapping
 *  across the cycle boundary since the sunrise quarter is chronologically last, immediately before
 *  the day quarter that opens the next cycle. */
export function resolveSunPosition(now: number = Date.now()): SunPosition | null {
  const quarter = CYCLE_DURATION_MS / 4;
  const t = now % CYCLE_DURATION_MS;
  if (t >= 2 * quarter && t < 3 * quarter) return null; // night - sun below horizon, no shadow
  const posInArc = t < 3 * quarter ? t + quarter : t - 3 * quarter; // 0 at sunrise start, 3*quarter at sunset end
  const arcProgress = posInArc / (3 * quarter); // 0 = just risen, 0.5 = solar noon, 1 = about to set
  return {
    elevation: Math.sin(arcProgress * Math.PI), // 0 at both horizon ends, 1 at solar noon
    azimuth: arcProgress * 2 - 1, // -1 (just risen) .. 0 (solar noon) .. 1 (about to set)
  };
}
