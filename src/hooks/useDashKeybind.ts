import { useEffect, useRef } from 'react';
import { isTypingTarget } from '@/utils/keyboard';
import { KEY_TO_FACING, type Facing } from './useGridMovement';

/** Shift alone starts Dash - held down, it runs in whichever direction the player is currently
 *  facing until released, out of Stamina, or blocked (see useDash.ts). A direction key pressed
 *  while Shift is already held steers the ongoing dash to that new facing instead of taking a
 *  normal step (useGridMovement's own keydown handler explicitly ignores shift-held keydowns so
 *  the two never both fire from one keypress) - startDash itself treats an already-running hold as
 *  "just update the facing," not a second overlapping dash. */
export function useDashKeybind(startDash: (facing?: Facing) => void, stopDash: () => void, enabled: boolean) {
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
      if (isTypingTarget(e)) return;
      if (e.key === 'Shift') {
        if (!shiftHeldRef.current) {
          shiftHeldRef.current = true;
          startDash();
        }
        return;
      }
      if (!e.shiftKey) return;
      const facing = KEY_TO_FACING[e.key];
      if (!facing) return;
      e.preventDefault();
      startDash(facing);
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key !== 'Shift') return;
      shiftHeldRef.current = false;
      stopDash();
    }

    // Losing focus (alt-tab, clicking outside the game) never fires a keyup for whatever was held
    // - without this, the hold would keep running (or the browser would eventually deliver a keyup
    // for the wrong key entirely) until some unrelated keypress happened to touch Shift again.
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
