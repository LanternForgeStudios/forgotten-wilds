import { useCallback, useRef } from 'react';
import { callDash } from '@/firebase/functionsClient';
import { usePlayerStore } from '@/state/usePlayerStore';

// How often the stamina cost fires while dashHeld stays true - the server-authoritative dash Cloud
// Function (functions/src/functions/dash.ts) charges a fixed cost per call, not per tile, so this
// is now a plain fixed-interval debit fully decoupled from movement/tiles (continuous movement has
// no more "tiles" to debit per - see ExplorationScene.ts's updatePlayerPhysics). Kept at the same
// cadence the old tile-stepping loop used (DASH_STEP_MS) purely to preserve the existing stamina-
// drain feel, not because anything about the interval itself is tied to movement anymore.
const DASH_STAMINA_INTERVAL_MS = 120;

interface UseDashOptions {
  /** Flips the shared movement-input ref's dashHeld flag (see useMovementInput.ts) - the actual
   *  speed boost is Arcade Physics reading that flag every frame in ExplorationScene.ts, not
   *  anything this hook does directly. This hook only owns the Stamina side. */
  setDashHeld: (held: boolean) => void;
}

/** Dash: hold to run faster until Stamina runs out or released - the server-authoritative Stamina
 *  debit (functions/src/functions/dash.ts) fires on a fixed interval while held, independent of
 *  movement/collision (which Arcade Physics now owns entirely on its own, continuously). Call
 *  `startDash` on press and `stopDash` on release - see useDashKeybind.ts (keyboard: Shift held)
 *  and MobileHud.tsx (touch: press-and-hold). */
export function useDash({ setDashHeld }: UseDashOptions) {
  const dashingRef = useRef(false);
  const intervalRef = useRef<number | undefined>(undefined);
  const patchStats = usePlayerStore((s) => s.patchStats);
  const patchPlayer = usePlayerStore((s) => s.patchPlayer);

  const stopDash = useCallback(() => {
    dashingRef.current = false;
    setDashHeld(false);
    if (intervalRef.current !== undefined) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, [setDashHeld]);

  const startDash = useCallback(() => {
    if (dashingRef.current) return;
    dashingRef.current = true;
    setDashHeld(true);

    function tick() {
      callDash()
        .then((result) => {
          patchStats({ stamina: result.stamina, maxStamina: result.maxStamina });
          patchPlayer({ staminaUpdatedAt: result.staminaUpdatedAt });
        })
        .catch(() => {
          stopDash(); // out of Stamina
        });
    }

    tick();
    intervalRef.current = window.setInterval(tick, DASH_STAMINA_INTERVAL_MS);
  }, [patchStats, patchPlayer, setDashHeld, stopDash]);

  return { startDash, stopDash };
}
