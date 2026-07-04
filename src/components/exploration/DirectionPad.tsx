import { useRef } from 'react';
import type { Facing } from '@/hooks/useGridMovement';
import styles from './DirectionPad.module.css';

const REPEAT_MS = 150;

interface DirectionPadProps {
  attemptMove: (facing: Facing) => void;
}

/** Visible 4-direction arrow control for mobile - a supplement to drag-to-move for players who'd
 *  rather tap/hold a button than swipe across the map itself. */
export function DirectionPad({ attemptMove }: DirectionPadProps) {
  const intervalRef = useRef<number | undefined>(undefined);

  function start(facing: Facing) {
    attemptMove(facing);
    intervalRef.current = window.setInterval(() => attemptMove(facing), REPEAT_MS);
  }

  function stop() {
    if (intervalRef.current !== undefined) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }

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
