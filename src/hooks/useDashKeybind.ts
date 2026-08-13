import { useEffect, useRef } from 'react';
import { isTypingTarget } from '@/utils/keyboard';

/** Shift alone starts Dash - held down, it runs (faster, in whatever direction is currently held -
 *  or the last-faced direction if none is, see ExplorationScene.ts's updatePlayerPhysics) until
 *  released, out of Stamina, or blocked. No direction-key branching needed here anymore - unlike
 *  the old discrete-step model, dash no longer owns a separate movement loop that a direction key
 *  had to "steer"; holding Shift and a direction key are just two independent booleans on the same
 *  shared input ref (see useMovementInput.ts), read together every physics frame. */
export function useDashKeybind(startDash: () => void, stopDash: () => void, enabled: boolean) {
  const shiftHeldRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      if (shiftHeldRef.current) {
        shiftHeldRef.current = false;
        stopDash();
      }
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e) || e.key !== 'Shift' || shiftHeldRef.current) return;
      shiftHeldRef.current = true;
      startDash();
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key !== 'Shift') return;
      shiftHeldRef.current = false;
      stopDash();
    }

    // Losing focus (alt-tab, clicking outside the game) never fires a keyup for whatever was held
    // - without this, the dash would keep running until some unrelated keypress happened to touch
    // Shift again.
    function handleBlur() {
      if (!shiftHeldRef.current) return;
      shiftHeldRef.current = false;
      stopDash();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [startDash, stopDash, enabled]);
}
