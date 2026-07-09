import { useEffect, useRef, type RefObject } from 'react';
import type { Facing } from './useGridMovement';

const DEADZONE_PX = 16;
const REPEAT_MS = 140;

/** Lets a touch/mouse drag on `containerRef` drive grid movement, for devices where the keyboard
 *  controls this game otherwise relies on don't exist. The drag origin anchors on pointerdown (like
 *  a joystick with no visible base) - direction is derived from the offset each move, and holding
 *  past the deadzone repeats `attemptMove` on an interval so you don't have to wiggle your finger to
 *  keep walking. */
export function useDragMovement(
  containerRef: RefObject<HTMLElement | null>,
  attemptMove: (facing: Facing) => void,
  active: boolean,
) {
  const attemptMoveRef = useRef(attemptMove);
  attemptMoveRef.current = attemptMove;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !active) return;

    let origin: { x: number; y: number } | null = null;
    let facing: Facing | null = null;
    let intervalId: number | undefined;

    function handlePointerDown(e: PointerEvent) {
      origin = { x: e.clientX, y: e.clientY };
      facing = null;
      intervalId = window.setInterval(() => {
        if (facing) attemptMoveRef.current(facing);
      }, REPEAT_MS);
    }

    function handlePointerMove(e: PointerEvent) {
      if (!origin) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (Math.abs(dx) < DEADZONE_PX && Math.abs(dy) < DEADZONE_PX) {
        facing = null;
        return;
      }
      facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    }

    function endDrag() {
      origin = null;
      facing = null;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    }

    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('pointerleave', endDrag);
    // Element-level pointerup/pointercancel can occasionally never fire on a touch device (the
    // gesture gets interrupted, the finger leaves the viewport, a browser quirk swallows it) -
    // a dropped release event would otherwise leave the repeat interval walking forever. Window
    // listeners catch the release no matter where it lands.
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('pointerleave', endDrag);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [containerRef, active]);
}
