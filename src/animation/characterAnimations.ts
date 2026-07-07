import type { Facing } from '@/hooks/useGridMovement';

export type MovementState = 'idle' | 'walking' | 'running';

/** Describes how a single character's sprite sheet maps movement state + facing to a row, and how
 *  fast its walk-cycle frames should play. Each character type (player, later NPCs/enemies) gets
 *  its own layout - nothing here assumes row count/order, so a differently-shaped sheet is purely
 *  additive, not a change to this shape. */
export interface CharacterAnimationLayout {
  frameSize: { width: number; height: number };
  rows: Partial<Record<MovementState, Record<Facing, number>>>;
  frameCount: number;
  frameDurationMs: number;
}

export const PLAYER_ANIMATION_LAYOUT: CharacterAnimationLayout = {
  frameSize: { width: 32, height: 32 },
  rows: {
    walking: { down: 0, left: 1, up: 2, right: 3 },
    running: { down: 4, left: 5, up: 6, right: 7 },
  },
  frameCount: 4,
  frameDurationMs: 120,
};

/** Which sheet row to render for a given state/facing, or null when the sheet has no row for that
 *  state (e.g. no dedicated idle row - callers should pin to frame 0 of the walking row instead). */
export function resolveAnimationRow(
  layout: CharacterAnimationLayout,
  state: MovementState,
  facing: Facing,
): number | null {
  if (state === 'idle') return null;
  return layout.rows[state]?.[facing] ?? null;
}

/** Same as resolveAnimationRow, but falls back to the walking row's frame (standing still, frame
 *  0) when there's no dedicated idle row - what every render call site actually wants to display,
 *  since "no row" isn't a renderable answer on its own. */
export function resolveDisplayRow(layout: CharacterAnimationLayout, state: MovementState, facing: Facing): number {
  return resolveAnimationRow(layout, state, facing) ?? resolveAnimationRow(layout, 'walking', facing) ?? 0;
}
