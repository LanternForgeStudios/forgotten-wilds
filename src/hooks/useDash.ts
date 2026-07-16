import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { Facing, GridPosition } from './useGridMovement';
import { callDash } from '@/firebase/functionsClient';
import { usePlayerStore } from '@/state/usePlayerStore';

// Must exceed useGridMovement's own dash-step throttle (dashStepIntervalMs, 100ms default) or each
// scheduled attemptMove call would just get swallowed by that throttle instead of actually
// advancing a tile - the whole hold would then stop after its very first tile, since every
// subsequent attemptMove call gets silently no-op'd by the movement throttle and the "position
// didn't change" collision check mistakes that for a wall. This no longer has to also budget for a
// server round-trip (see the stamina-debit comment in startDash below), so it's kept just
// comfortably above the throttle floor rather than padded for network latency - the closer to it,
// the smoother a held dash feels.
const DASH_STEP_MS = 120;
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

/** Dash: hold to run in the given direction (or the player's current facing, e.g. the mobile Dash
 *  button) until Stamina runs out, the held direction changes to something new, or movement is
 *  blocked by collision - replacing the old fixed "5 tiles for a flat upfront cost" model. Movement
 *  starts on the very first held frame - no ramp-up beat. Stamina is debited per tile via the
 *  server-authoritative dash Cloud Function (functions/src/functions/dash.ts), fired
 *  fire-and-forget alongside each tile's movement rather than gating it - see the loop's own
 *  comment for why. Call `startDash` on press (optionally with an explicit facing) and `stopDash`
 *  on release - see useDashKeybind.ts (keyboard: Shift held) and MobileHud.tsx (touch:
 *  press-and-hold). */
export function useDash({ attemptMove, positionRef }: UseDashOptions) {
  const lastDashEndedAtRef = useRef(0);
  const dashingRef = useRef(false);
  // The currently-held direction - null means "not dashing" and is also the hold-loop's own stop
  // signal. A direction key pressed while already dashing just updates this (see startDash's
  // early-return branch); the run loop below reads it fresh every tile instead of capturing one
  // fixed facing for the whole hold.
  const facingRef = useRef<Facing | null>(null);
  const patchStats = usePlayerStore((s) => s.patchStats);
  const patchPlayer = usePlayerStore((s) => s.patchPlayer);
  // A dash step landing on a transition tile changes locations mid-loop - for a same-kind
  // transition the scene doesn't remount, so this hook's hold-loop keeps running with whatever
  // attemptMove it captured at call time, which would now be bound to the *old* map's collision
  // data while positionRef has already moved on to the new location's spawn point. Reading through
  // a ref (same pattern useDragMovement.ts/useGridMovement.ts already use for this exact class of
  // bug) guarantees every remaining iteration validates against whichever map is actually current.
  const attemptMoveRef = useRef(attemptMove);
  attemptMoveRef.current = attemptMove;

  const stopDash = useCallback(() => {
    facingRef.current = null;
  }, []);

  const startDash = useCallback(
    async (requestedFacing?: Facing) => {
      if (dashingRef.current) {
        // Already running - just steer it, don't start a second overlapping hold.
        if (requestedFacing) facingRef.current = requestedFacing;
        return;
      }
      const now = Date.now();
      if (now - lastDashEndedAtRef.current < DASH_COOLDOWN_MS) return;

      const facing = requestedFacing ?? positionRef.current.facing;
      facingRef.current = facing;
      dashingRef.current = true;

      // Each tile's stamina debit is fired but NOT awaited before the next tile's attemptMove -
      // waiting on that round-trip every single tile is what made a held dash visibly stutter
      // (move, pause, move, pause) even on fast local latency, since the server call always
      // outlasted GLIDE_MS's glide duration. The move itself was never server-persisted state to
      // begin with (only the Stamina cost is), so this trades a small amount of debit strictness
      // (a rejected call's tile has already visually happened by the time the rejection arrives -
      // at most one tile's worth) for genuinely smooth, continuous movement. staminaExhausted is
      // set the instant any call rejects, stopping the loop before the *next* tile fires.
      let isDashStart = true;
      let staminaExhausted = false;
      try {
        while (facingRef.current !== null && !staminaExhausted) {
          const before = positionRef.current;
          attemptMoveRef.current(facingRef.current, { isDash: true });
          callDash({ isDashStart })
            .then((result) => {
              patchStats({ stamina: result.stamina, maxStamina: result.maxStamina });
              patchPlayer({ staminaUpdatedAt: result.staminaUpdatedAt });
            })
            .catch(() => {
              staminaExhausted = true; // out of Stamina (or, rarely, still on cooldown)
            });
          isDashStart = false;
          await wait(DASH_STEP_MS);
          const after = positionRef.current;
          if (after.x === before.x && after.y === before.y) break; // blocked - stop the dash here
        }
      } finally {
        dashingRef.current = false;
        facingRef.current = null;
        lastDashEndedAtRef.current = Date.now();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patchStats, patchPlayer, positionRef],
  );

  return { startDash, stopDash };
}
