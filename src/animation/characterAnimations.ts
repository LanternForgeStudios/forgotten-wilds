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

/** Single-row ambient idle loop (a breathing/sway cycle) for a stationary entity - NPCs today, and
 *  potentially overworld enemy field-icons later (see useFieldEncounters.ts). Distinct from
 *  PLAYER_ANIMATION_LAYOUT, which has no idle row of its own (the player is always either walking,
 *  running, or pinned to a fixed standing frame - see resolveDisplayRow). Every facing points at
 *  the same single row: NPCs always render facing 'down' today (see ExplorationScene.ts's
 *  upsertEntity, which hardcodes that), so only 'down' is ever actually requested in practice, but
 *  CharacterAnimationLayout's `rows` type requires all four facings once a state is present at
 *  all. Not every NPC/enemy sheet actually has an idle row of its own - callers must check
 *  `anims.exists(...)` before playing (see upsertEntity) and fall back to a static frame instead of
 *  assuming one was defined. */
export const IDLE_ANIMATION_LAYOUT: CharacterAnimationLayout = {
  frameSize: { width: 72, height: 96 },
  rows: {
    idle: { down: 0, left: 0, up: 0, right: 0 },
  },
  frameCount: 4,
  frameDurationMs: 240,
};

const PLAYER_SKIN_ASSET_IDS = new Set(['sprite.player', 'sprite.player.male', 'sprite.player.female']);

/** Which layout applies to a given sprite sheet - the player's own skins (and its generic
 *  fallback) use PLAYER_ANIMATION_LAYOUT's walk/run shape; every other frameSize'd sprite (NPCs,
 *  and other players' presence entities sharing this same picker via upsertEntity) uses the
 *  idle-only shape instead. A per-asset lookup rather than a hardcoded constant, so ExplorationScene
 *  doesn't have to guess which shape a given entity's sheet actually has. */
export function animationLayoutForSprite(spriteAssetId: string): CharacterAnimationLayout {
  return PLAYER_SKIN_ASSET_IDS.has(spriteAssetId) ? PLAYER_ANIMATION_LAYOUT : IDLE_ANIMATION_LAYOUT;
}

/** Which sheet row to render for a given state/facing, or null when the sheet has no row for that
 *  state (e.g. a walking-only sheet has no idle row, or vice versa) - callers should pin to frame
 *  0 of the walking row instead in that case (see resolveDisplayRow). */
export function resolveAnimationRow(
  layout: CharacterAnimationLayout,
  state: MovementState,
  facing: Facing,
): number | null {
  return layout.rows[state]?.[facing] ?? null;
}

/** Same as resolveAnimationRow, but falls back to the walking row's frame (standing still, frame
 *  0) when there's no dedicated idle row - what every render call site actually wants to display,
 *  since "no row" isn't a renderable answer on its own. */
export function resolveDisplayRow(layout: CharacterAnimationLayout, state: MovementState, facing: Facing): number {
  return resolveAnimationRow(layout, state, facing) ?? resolveAnimationRow(layout, 'walking', facing) ?? 0;
}
