import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { Facing, GridPosition } from './useGridMovement';
import { callDash } from '@/firebase/functionsClient';
import { usePlayerStore } from '@/state/usePlayerStore';

// Must exceed useGridMovement's own step throttle (220ms default) or each scheduled attemptMove
// call would just get swallowed by that throttle instead of actually advancing a tile. Also the
// pacing of each per-tile stamina-debit server call during a hold.
const DASH_STEP_MS = 170;
// "Getting ready to run" beat before movement actually starts - the dust effect (see
// ExplorationScene.playDashRampEffect via onRampUp below) fires immediately; actual tile movement
// begins once this elapses, unless Dash was released before then.
const DASH_RAMP_MS = 1000;
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
  /** Fires the instant a dash's 1s ramp-up begins (before any tile has moved) - the caller uses
   *  this to trigger a stationary dust puff (see ExplorationScene.playDashRampEffect). */
  onRampUp?: () => void;
}

/** Dash: hold to run in the given direction (or the player's current facing, e.g. the mobile Dash
 *  button) until Stamina runs out, the held direction changes to something new, or movement is
 *  blocked by collision - replacing the old fixed "5 tiles for a flat upfront cost" model. A 1s
 *  ramp-up (dust effect, no movement yet) precedes the actual run. Stamina is debited per tile via
 *  the server-authoritative dash Cloud Function (functions/src/functions/dash.ts) - each tile's
 *  move only proceeds once the server confirms that tile's debit, so a network hiccup or an empty
 *  Stamina bar mid-run stops the hold exactly where the server says it can afford, never ahead of
 *  it. Call `startDash` on press (optionally with an explicit facing) and `stopDash` on release -
 *  see useDashKeybind.ts (keyboard: Shift held) and MobileHud.tsx (touch: press-and-hold). */
export function useDash({ attemptMove, positionRef, onRampUp }: UseDashOptions) {
  const lastDashEndedAtRef = useRef(0);
  const dashingRef = useRef(false);
  // The currently-held direction - null means "not dashing" and is also the hold-loop's own stop
  // signal. A direction key pressed while already dashing just updates this (see startDash's
  // early-return branch) rather than restarting the ramp-up; the run loop below reads it fresh
  // every tile instead of capturing one fixed facing for the whole hold.
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
  const onRampUpRef = useRef(onRampUp);
  onRampUpRef.current = onRampUp;

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
      onRampUpRef.current?.();
      await wait(DASH_RAMP_MS);
      // Released (or steered to null some other way - never happens today, but defensive) during
      // the ramp-up, before a single tile ever moved.
      if (facingRef.current === null) {
        dashingRef.current = false;
        lastDashEndedAtRef.current = Date.now();
        return;
      }

      try {
        let isDashStart = true;
        while (facingRef.current !== null) {
          const before = positionRef.current;
          let result;
          try {
            result = await callDash({ isDashStart });
          } catch {
            break; // out of Stamina (or, rarely, still on cooldown) - stop the hold here
          }
          isDashStart = false;
          patchStats({ stamina: result.stamina, maxStamina: result.maxStamina });
          patchPlayer({ staminaUpdatedAt: result.staminaUpdatedAt });
          if (facingRef.current === null) break; // released while the server call was in flight
          attemptMoveRef.current(facingRef.current, { isDash: true });
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
