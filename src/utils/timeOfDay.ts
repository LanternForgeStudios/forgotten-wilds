import type { TimePhase } from '@/types';

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
