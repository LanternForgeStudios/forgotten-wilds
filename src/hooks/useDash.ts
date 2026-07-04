import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { Facing, GridPosition } from './useGridMovement';
import { callDash } from '@/firebase/functionsClient';
import { usePlayerStore } from '@/state/usePlayerStore';

const DASH_TILES = 5;
// Must exceed useGridMovement's own step throttle (150ms default) or each scheduled attemptMove
// call would just get swallowed by that throttle instead of actually advancing a tile.
const DASH_STEP_MS = 170;
const DASH_COOLDOWN_MS = 1000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface UseDashOptions {
  attemptMove: (facing: Facing, options?: { isDash?: boolean }) => void;
  positionRef: RefObject<GridPosition>;
}

/** Dash: up to 5 tiles in the direction the player is currently facing, stopping early on
 *  collision, gated by the server-authoritative Stamina cost (see functions/src/functions/dash.ts)
 *  plus a client-side 1s cooldown between attempts (a pacing limit, not an anti-cheat one - the
 *  finite, slowly-regenerating Stamina cost is what actually rate-limits this server-side). */
export function useDash({ attemptMove, positionRef }: UseDashOptions) {
  const lastDashAtRef = useRef(0);
  const dashingRef = useRef(false);
  const patchStats = usePlayerStore((s) => s.patchStats);

  const dash = useCallback(async () => {
    if (dashingRef.current) return;
    const now = Date.now();
    if (now - lastDashAtRef.current < DASH_COOLDOWN_MS) return;
    lastDashAtRef.current = now;

    let result;
    try {
      result = await callDash();
    } catch {
      return; // not unlocked yet, or not enough stamina - no-op, no error UI for a movement flourish
    }
    patchStats({ stamina: result.stamina, maxStamina: result.maxStamina });

    dashingRef.current = true;
    try {
      const facing = positionRef.current.facing;
      for (let i = 0; i < DASH_TILES; i++) {
        const before = positionRef.current;
        attemptMove(facing, { isDash: true });
        await wait(DASH_STEP_MS);
        const after = positionRef.current;
        if (after.x === before.x && after.y === before.y) break; // blocked - stop the dash here
      }
    } finally {
      dashingRef.current = false;
    }
  }, [attemptMove, patchStats, positionRef]);

  return dash;
}
