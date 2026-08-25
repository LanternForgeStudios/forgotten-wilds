import { create } from 'zustand';
import type { TimePhase } from '@/types';
import { resolveTimePhase } from '@/utils/timeOfDay';

interface TimeOfDayState {
  phase: TimePhase;
}

/** The single shared world clock (see src/utils/timeOfDay.ts) - one module-level interval ticks
 *  this store for the whole app, rather than each of OverworldScene/TownScene polling
 *  independently. Phase changes are coarse (minutes apart), so a 5s poll is plenty responsive
 *  without any real cost. */
export const useTimeOfDayStore = create<TimeOfDayState>(() => ({
  phase: resolveTimePhase(),
}));

setInterval(() => {
  useTimeOfDayStore.setState({ phase: resolveTimePhase() });
}, 5000);
