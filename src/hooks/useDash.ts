import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { Facing, GridPosition } from './useGridMovement';
import { callDash } from '@/firebase/functionsClient';
import { usePlayerStore } from '@/state/usePlayerStore';

const DASH_TILES = 5;
// Must exceed useGridMovement's own step throttle (150ms default) or each scheduled attemptMove
// call would just get swallowed by that throttle instead of actually advancing a tile.
const DASH_STEP_MS = 170;
// Matches the server's own hard floor (functions/src/functions/dash.ts) - not itself what prevents
// spamming (the server enforces that regardless of what the client sends), just avoids firing a
// network call the client already knows would be rejected.
const DASH_COOLDOWN_MS = 3000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface UseDashOptions {
  attemptMove: (facing: Facing, options?: { isDash?: boolean }) => void;
  positionRef: RefObject<GridPosition>;
}

/** Dash: up to 5 tiles in the given direction (or the player's current facing if none is given,
 *  e.g. the mobile Dash button), stopping early on collision, gated by the server-authoritative
 *  Stamina cost (see functions/src/functions/dash.ts) plus a client-side 1s cooldown between
 *  attempts (a pacing limit, not an anti-cheat one - the finite, slowly-regenerating Stamina cost
 *  is what actually rate-limits this server-side). */
export function useDash({ attemptMove, positionRef }: UseDashOptions) {
  const lastDashAtRef = useRef(0);
  const dashingRef = useRef(false);
  const patchStats = usePlayerStore((s) => s.patchStats);
  const patchPlayer = usePlayerStore((s) => s.patchPlayer);
  // A dash step landing on a transition tile changes locations mid-loop (handleStep's transition
  // check runs even for a dash step - only the encounter roll is skipped) - for a same-kind
  // transition (e.g. Town outdoor -> a building interior) the scene doesn't remount, so this
  // hook's dash() keeps running with whatever attemptMove it captured at call time, which is now
  // bound to the *old* map's collision data while positionRef has already moved on to the new
  // location's spawn point. Reading through a ref (same pattern useDragMovement.ts and
  // useGridMovement.ts already use for this exact class of bug) guarantees every remaining
  // iteration of an in-flight dash validates against whichever map is actually current.
  const attemptMoveRef = useRef(attemptMove);
  attemptMoveRef.current = attemptMove;

  const dash = useCallback(async (requestedFacing?: Facing) => {
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
    patchPlayer({ staminaUpdatedAt: result.staminaUpdatedAt });

    dashingRef.current = true;
    try {
      // The Shift+direction keybind passes the held direction explicitly, since it may not match
      // whichever way the player was last facing. The mobile Dash button has no direction of its
      // own to offer, so it falls back to the current facing.
      const facing = requestedFacing ?? positionRef.current.facing;
      for (let i = 0; i < DASH_TILES; i++) {
        const before = positionRef.current;
        attemptMoveRef.current(facing, { isDash: true });
        await wait(DASH_STEP_MS);
        const after = positionRef.current;
        if (after.x === before.x && after.y === before.y) break; // blocked - stop the dash here
      }
    } finally {
      dashingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchStats, patchPlayer, positionRef]);

  return dash;
}
