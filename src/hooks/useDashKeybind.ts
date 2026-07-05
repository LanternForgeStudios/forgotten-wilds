import { useEffect } from 'react';
import { isTypingTarget } from '@/utils/keyboard';
import { KEY_TO_FACING, type Facing } from './useGridMovement';

/** Shift+direction triggers Dash - a normal (non-shift) press of the same keys still just takes a
 *  single step, handled separately by useGridMovement (which explicitly ignores shift-held
 *  keydowns so the two don't both fire from one keypress). Passes the held direction through so
 *  Dash goes that way even if it doesn't match whichever way the player was last facing - without
 *  this, Shift+Right while facing up would dash up instead of right. */
export function useDashKeybind(dash: (facing?: Facing) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      const facing = KEY_TO_FACING[e.key];
      if (!e.shiftKey || !facing) return;
      e.preventDefault();
      dash(facing);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dash, enabled]);
}
