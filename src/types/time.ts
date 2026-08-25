/** Day/night cycle phase (see src/utils/timeOfDay.ts's resolveTimePhase) - a shared, real-time-
 *  driven ambient state for overworld/town maps, no quest gating (unlike WeatherKind's story
 *  locks). Every client computes the same phase for the same instant. */
export type TimePhase = 'day' | 'sunrise' | 'sunset' | 'night';
