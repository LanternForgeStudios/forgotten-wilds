import type { Facing } from '@/hooks/useGridMovement';
import { getAssetDefinition } from '@/assets/assetManager';

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

const PLAYER_SKIN_ASSET_IDS = new Set(['sprite.player', 'sprite.player.male', 'sprite.player.female']);
const DEFAULT_IDLE_FRAME_SIZE = { width: 72, height: 96 };
const DEFAULT_IDLE_FRAME_COUNT = 4;

/** Which layout applies to a given sprite sheet - the player's own skins (and its generic
 *  fallback) use PLAYER_ANIMATION_LAYOUT's walk/run shape; every other frameSize'd sprite (NPCs,
 *  enemies, and other players' presence entities sharing this same picker via upsertEntity/
 *  BattleScene's createEnemySlot) gets a single-row ambient idle loop (a breathing/fight-stance
 *  sway) instead. Every facing points at the same row: neither NPCs nor enemies ever render with
 *  a real facing today (both are always shown front/down-on), so only 'down' is ever actually
 *  requested in practice, but CharacterAnimationLayout's `rows` type requires all four once a
 *  state is present at all.
 *
 *  Frame count is derived from the registry's own `dimensions.width / frameSize.width` (a
 *  single-row sheet) rather than a hardcoded constant - the first two idle sheets built
 *  (Elias Rowan, Finn Rowan) happened to both be 4 frames, but the enemy idle sheets that followed
 *  (Mothling, Greater Mothling, Restless Miner) are 8 frames, and hardcoding 4 would have read
 *  frames past the end of their texture. Falls back to a 4-frame default for a sprite with no
 *  frameSize at all (shouldn't normally be asked for a layout, but keeps this total either way).
 *
 *  Not every NPC/enemy sheet actually has an idle row of its own - callers must check
 *  `anims.exists(...)` before playing (see upsertEntity/createEnemySlot) and fall back to a static
 *  frame instead of assuming one was defined. */
export function animationLayoutForSprite(spriteAssetId: string): CharacterAnimationLayout {
  if (PLAYER_SKIN_ASSET_IDS.has(spriteAssetId)) return PLAYER_ANIMATION_LAYOUT;
  const def = getAssetDefinition(spriteAssetId);
  const frameSize = def.frameSize ?? DEFAULT_IDLE_FRAME_SIZE;
  const frameCount =
    def.dimensions && frameSize.width > 0 ? Math.max(1, Math.round(def.dimensions.width / frameSize.width)) : DEFAULT_IDLE_FRAME_COUNT;
  return {
    frameSize,
    rows: { idle: { down: 0, left: 0, up: 0, right: 0 } },
    frameCount,
    frameDurationMs: 240,
  };
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
