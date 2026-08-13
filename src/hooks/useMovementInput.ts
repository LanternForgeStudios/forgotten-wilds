import { useCallback, useEffect, useRef } from 'react';
import { isTypingTarget } from '@/utils/keyboard';
import { KEY_TO_FACING, type Facing } from './useGridMovement';

export interface MovementInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  dashHeld: boolean;
}

function emptyInputState(): MovementInputState {
  return { up: false, down: false, left: false, right: false, dashHeld: false };
}

const FACING_TO_KEY: Record<Facing, keyof Omit<MovementInputState, 'dashHeld'>> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
};

/** Owns the shared, per-frame-read input state Arcade Physics movement drives from (see
 *  ExplorationScene.ts's updatePlayerPhysics) - keyboard (WASD/arrows for direction) plus
 *  setDirectionHeld/setDashHeld for every other input source (DirectionPad, useDragMovement,
 *  useDash's Shift/touch-button wiring) to drive the SAME ref, so they compose naturally: holding
 *  a D-pad button while also pressing the matching arrow key keeps that direction held until BOTH
 *  release it, rather than the second source's release turning movement off while the first is
 *  still held (see the hold-count tracking below). Replaces useGridMovement's old discrete,
 *  step-per-keypress keyboard handling entirely - this only ever reports "is this direction/dash
 *  currently held," never takes a movement action itself. */
export function useMovementInput(enabled: boolean) {
  const inputRef = useRef<MovementInputState>(emptyInputState());
  const holdCountRef = useRef<Record<Facing, number>>({ up: 0, down: 0, left: 0, right: 0 });

  const setDirectionHeld = useCallback((facing: Facing, held: boolean) => {
    const counts = holdCountRef.current;
    counts[facing] = Math.max(0, counts[facing] + (held ? 1 : -1));
    inputRef.current[FACING_TO_KEY[facing]] = counts[facing] > 0;
  }, []);

  const setDashHeld = useCallback((held: boolean) => {
    inputRef.current.dashHeld = held;
  }, []);

  const clearAll = useCallback(() => {
    inputRef.current = emptyInputState();
    holdCountRef.current = { up: 0, down: 0, left: 0, right: 0 };
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearAll();
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      // e.repeat guards against the OS's own key-auto-repeat re-firing keydown for a key that's
      // already held - without it, every repeat would increment holdCountRef again with no
      // matching keyup, permanently stuck-on movement after the first release.
      if (isTypingTarget(e) || e.repeat) return;
      const facing = KEY_TO_FACING[e.key];
      if (!facing) return;
      e.preventDefault();
      setDirectionHeld(facing, true);
    }

    function handleKeyUp(e: KeyboardEvent) {
      const facing = KEY_TO_FACING[e.key];
      if (!facing) return;
      setDirectionHeld(facing, false);
    }

    // Losing focus (alt-tab, clicking outside the game) never fires a keyup for whatever was held
    // - without this the player would keep walking in whatever direction was last held.
    function handleBlur() {
      clearAll();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      clearAll();
    };
  }, [enabled, setDirectionHeld, clearAll]);

  return { inputRef, setDirectionHeld, setDashHeld };
}
