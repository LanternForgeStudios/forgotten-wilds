import { useEffect, useRef } from 'react';
import type { Facing } from '@/hooks/useGridMovement';
import styles from './DirectionPad.module.css';

interface DirectionPadProps {
  setDirectionHeld: (facing: Facing, held: boolean) => void;
}

/** Visible 4-direction arrow control for mobile - a supplement to drag-to-move for players who'd
 *  rather tap/hold a button than swipe across the map itself. Just reports "this direction is
 *  currently held" to the shared movement-input ref (see useMovementInput.ts) - no repeat-polling
 *  interval needed, since Arcade Physics already re-reads the ref every frame on its own. */
export function DirectionPad({ setDirectionHeld }: DirectionPadProps) {
  // Tracks which button is currently down on THIS pointer, so a dropped pointerup/pointercancel
  // (gesture interrupted, finger drags off-screen, browser quirk) can still be released by the
  // window-level fallback below without needing to know which facing it was.
  const heldFacingRef = useRef<Facing | null>(null);

  function start(facing: Facing) {
    if (heldFacingRef.current) setDirectionHeld(heldFacingRef.current, false);
    heldFacingRef.current = facing;
    setDirectionHeld(facing, true);
  }

  function stop() {
    if (heldFacingRef.current) {
      setDirectionHeld(heldFacingRef.current, false);
      heldFacingRef.current = null;
    }
  }

  // Touch devices occasionally never deliver a pointerup/pointercancel to the button that
  // started the hold (gesture interrupted, finger drags off-screen, browser quirk) - without
  // this, a dropped event leaves that direction stuck held forever. A window-level listener
  // catches the release wherever it actually lands, and unmounting mid-hold (e.g. an overlay
  // swaps this component out) can't leak the held state either.
  useEffect(() => {
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      stop();
    };
  }, []);

  function directionButton(facing: Facing, label: string, className: string) {
    return (
      <button
        type="button"
        className={`${styles.button} ${className}`}
        onPointerDown={(e) => {
          e.preventDefault();
          start(facing);
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
      >
        {label}
      </button>
    );
  }

  return (
    <div className={styles.pad} style={{ touchAction: 'none' }}>
      {directionButton('up', '▲', styles.up)}
      {directionButton('left', '◀', styles.left)}
      {directionButton('right', '▶', styles.right)}
      {directionButton('down', '▼', styles.down)}
    </div>
  );
}
