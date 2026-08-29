import { create } from 'zustand';
import type { SunPosition, TimePhase } from '@/types';
import { resolveSunPosition, resolveTimePhase } from '@/utils/timeOfDay';

interface TimeOfDayState {
  phase: TimePhase;
  /** Continuous sun position for cast-shadow rotation/length (see timeOfDay.ts's
   *  resolveSunPosition) - null during night. Computed from the same `now` snapshot as `phase`
   *  every tick, so the two never disagree about which phase a given sun position belongs to. */
  sunPosition: SunPosition | null;
}

function resolve(): TimeOfDayState {
  const now = Date.now();
  return { phase: resolveTimePhase(now), sunPosition: resolveSunPosition(now) };
}

/** The single shared world clock (see src/utils/timeOfDay.ts) - one module-level interval ticks
 *  this store for the whole app, rather than each of OverworldScene/TownScene polling
 *  independently. Phase changes are coarse (minutes apart), and the sun sweeps its full visible
 *  arc over 18 real minutes, so a 5s poll is still well under 1 degree of shadow rotation per
 *  step - plenty smooth without any real cost. */
export const useTimeOfDayStore = create<TimeOfDayState>(() => resolve());

setInterval(() => {
  useTimeOfDayStore.setState(resolve());
}, 5000);
