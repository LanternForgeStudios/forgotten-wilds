import type { CharacterAnimationLayout, MovementState } from '@/animation/characterAnimations';
import type { Facing } from '@/hooks/useGridMovement';

const FACINGS: Facing[] = ['down', 'left', 'up', 'right'];
const ANIMATED_STATES: MovementState[] = ['walking', 'running'];

/** Namespaced by textureKey since Phaser's AnimationManager keys are global per-game, not
 *  per-texture - without this, two different character sheets both having a "walking-down" row
 *  would collide on the same animation key. */
export function animationKey(textureKey: string, state: MovementState, facing: Facing): string {
  return `${textureKey}-${state}-${facing}`;
}

/** Registers one Phaser animation per (state, facing) row a layout actually defines - direct
 *  translation of CharacterAnimationLayout (src/animation/characterAnimations.ts, untouched) into
 *  scene.anims.create() calls. Safe to call more than once for the same textureKey (e.g. several
 *  entities sharing one sheet) - already-registered keys are skipped. Idle has no dedicated row on
 *  any sheet today (see resolveAnimationRow) and is intentionally not created here - callers should
 *  stop the sprite's animation and set an explicit frame via resolveDisplayRow instead. */
export function createCharacterAnimations(
  anims: Phaser.Animations.AnimationManager,
  textureKey: string,
  layout: CharacterAnimationLayout,
): void {
  for (const state of ANIMATED_STATES) {
    for (const facing of FACINGS) {
      const row = layout.rows[state]?.[facing];
      if (row == null) continue;
      const key = animationKey(textureKey, state, facing);
      if (anims.exists(key)) continue;
      anims.create({
        key,
        frames: anims.generateFrameNumbers(textureKey, {
          start: row * layout.frameCount,
          end: row * layout.frameCount + layout.frameCount - 1,
        }),
        frameRate: 1000 / layout.frameDurationMs,
        repeat: -1,
      });
    }
  }
}
