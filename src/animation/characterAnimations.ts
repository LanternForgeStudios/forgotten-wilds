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

/** NPCs whose sprite sheet includes real walk-cycle rows on top of the usual idle row, for an NPC
 *  that actually moves around (see `wanderRadius` in useWanderingNpcs.ts) rather than standing
 *  still - every other NPC/enemy still gets the generic idle-only layout below. A small explicit
 *  set (mirroring PLAYER_SKIN_ASSET_IDS's own pattern) rather than inferring this from the sheet's
 *  dimensions, since a 5-row idle+walk sheet and a 5-frame idle-only sheet aren't distinguishable
 *  from `dimensions` alone. */
const NPC_WALK_ASSET_IDS = new Set([
  'sprite.npc.nell-ashby',
  'sprite.npc.hunter-garrick',
  'sprite.npc.spirit-child',
  'sprite.npc.ranger-caleb',
  // Crimson Bayou (MSQ Volume II) - marsh-spirit/sabine-thorne both roam (wanderRadius) but were
  // built with idle-only sheets initially, same gap this whole set exists to avoid.
  'sprite.npc.marsh-spirit',
  'sprite.npc.sabine-thorne',
  // Shattered Desert (MSQ Volume V) - desert-ranger-tomas-vega roams Red Mesa (wanderRadius).
  'sprite.npc.desert-ranger-tomas-vega',
  // Frozen Frontier (MSQ Volume VI) - captain-astrid-frost roams Frosthaven, winter-spirit roams
  // Aurora Basin (both wanderRadius).
  'sprite.npc.captain-astrid-frost',
  'sprite.npc.winter-spirit',
  // Endless Prairie / Shattered Desert / Whispering Pines follow-up pass - sand-spirit (Celestial
  // Oasis), scout-niska (Highwind Crossing), and cedar-spirit (Ancient Cedar Shrine) all roam
  // (wanderRadius) but shipped idle-only originally; walk rows added to their existing PixelLab
  // characters via animate_character rather than a full regeneration.
  'sprite.npc.sand-spirit',
  'sprite.npc.scout-niska',
  'sprite.npc.cedar-spirit',
]);
/** Row layout for NPC_WALK_ASSET_IDS sheets: row 0 idle (breathing), rows 1-4 walking by facing -
 *  a fixed convention (not per-NPC configurable) since the build script that assembles these
 *  sheets controls the row order and can just always produce it this way. frameDurationMs stays at
 *  the same 240ms every other NPC's idle loop already uses (one shared value for the whole
 *  layout - see CharacterAnimationLayout) rather than the player's snappier 120ms, giving a
 *  town NPC's amble a slower, more ambient pace than the player's own brisk walk. */
const NPC_WALK_ANIMATION_LAYOUT: CharacterAnimationLayout = {
  frameSize: { width: 72, height: 96 },
  rows: {
    idle: { down: 0, left: 0, up: 0, right: 0 },
    walking: { down: 1, left: 2, up: 3, right: 4 },
  },
  frameCount: 4,
  frameDurationMs: 240,
};

/** Which layout applies to a given sprite sheet - the player's own skins (and its generic
 *  fallback) use PLAYER_ANIMATION_LAYOUT's walk/run shape; a `NPC_WALK_ASSET_IDS` NPC (one that
 *  actually wanders, see useWanderingNpcs.ts) uses NPC_WALK_ANIMATION_LAYOUT's idle+4-direction-walk
 *  shape; every other frameSize'd sprite (stationary NPCs, enemies, and other players' presence
 *  entities sharing this same picker via upsertEntity/BattleScene's createEnemySlot) gets a
 *  single-row ambient idle loop (a breathing/fight-stance sway) instead. For that stationary case,
 *  every facing points at the same row - a stationary NPC/enemy never renders with a real facing
 *  (always shown front/down-on), so only 'down' is ever actually requested in practice, but
 *  CharacterAnimationLayout's `rows` type requires all four once a state is present at all.
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
  if (NPC_WALK_ASSET_IDS.has(spriteAssetId)) return NPC_WALK_ANIMATION_LAYOUT;
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
