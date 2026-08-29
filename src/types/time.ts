/** Day/night cycle phase (see src/utils/timeOfDay.ts's resolveTimePhase) - a shared, real-time-
 *  driven ambient state for overworld/town maps, no quest gating (unlike WeatherKind's story
 *  locks). Every client computes the same phase for the same instant. */
export type TimePhase = 'day' | 'sunrise' | 'sunset' | 'night';

/** Continuous sun position for the same clock (see src/utils/timeOfDay.ts's resolveSunPosition) -
 *  drives cast-shadow rotation/length on overworld structures/interactables. `null` means the sun
 *  is below the horizon (night) - no shadow. `elevation` is 0 at the horizon rising to 1 at solar
 *  noon back to 0 at the horizon; `azimuth` sweeps -1 (just risen) through 0 (solar noon, shadow
 *  pointing straight down) to 1 (about to set). */
export interface SunPosition {
  elevation: number;
  azimuth: number;
}
