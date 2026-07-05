import { useEffect } from 'react';
import { isTypingTarget } from '@/utils/keyboard';

const DASH_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D']);

/** Shift+direction triggers Dash - a normal (non-shift) press of the same keys still just takes a
 *  single step, handled separately by useGridMovement (which explicitly ignores shift-held
 *  keydowns so the two don't both fire from one keypress). */
export function useDashKeybind(dash: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (!e.shiftKey || !DASH_KEYS.has(e.key)) return;
      e.preventDefault();
      dash();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dash, enabled]);
}
