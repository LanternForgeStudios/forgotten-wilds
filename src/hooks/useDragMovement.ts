import { useEffect, useRef, type RefObject } from 'react';
import type { Facing } from './useGridMovement';

const DEADZONE_PX = 16;

/** Lets a touch/mouse drag on `containerRef` drive movement, for devices where the keyboard
 *  controls this game otherwise relies on don't exist. The drag origin anchors on pointerdown (like
 *  a joystick with no visible base) - direction is derived from the offset each move and reported
 *  to the shared movement-input ref (see useMovementInput.ts) as a single held facing, updated as
 *  the drag direction changes; no repeat-polling interval needed since Arcade Physics already
 *  re-reads the ref every frame on its own. */
export function useDragMovement(
  containerRef: RefObject<HTMLElement | null>,
  setDirectionHeld: (facing: Facing, held: boolean) => void,
  active: boolean,
) {
  const setDirectionHeldRef = useRef(setDirectionHeld);
  setDirectionHeldRef.current = setDirectionHeld;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !active) return;

    let origin: { x: number; y: number } | null = null;
    let facing: Facing | null = null;

    function updateFacing(next: Facing | null) {
      if (facing === next) return;
      if (facing) setDirectionHeldRef.current(facing, false);
      if (next) setDirectionHeldRef.current(next, true);
      facing = next;
    }

    function handlePointerDown(e: PointerEvent) {
      origin = { x: e.clientX, y: e.clientY };
      updateFacing(null);
    }

    function handlePointerMove(e: PointerEvent) {
      if (!origin) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (Math.abs(dx) < DEADZONE_PX && Math.abs(dy) < DEADZONE_PX) {
        updateFacing(null);
        return;
      }
      updateFacing(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    }

    function endDrag() {
      origin = null;
      updateFacing(null);
    }

    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('pointerleave', endDrag);
    // Element-level pointerup/pointercancel can occasionally never fire on a touch device (the
    // gesture gets interrupted, the finger leaves the viewport, a browser quirk swallows it) -
    // a dropped release event would otherwise leave the held direction stuck on forever. Window
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
      endDrag();
    };
  }, [containerRef, active]);
}
