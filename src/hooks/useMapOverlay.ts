import { useEffect, useState } from 'react';
import { useCutsceneStore } from '@/state/useCutsceneStore';
import { isTypingTarget } from '@/utils/keyboard';

/** Open/close/suspend wiring for the player-invoked mini-map, shared across Town/Overworld/
 *  Dungeon scenes - CLAUDE.md's own flagged trigger point ("if a fourth or fifth overlay gets
 *  added, consider factoring the open/close/suspend wiring into a shared hook") since the map is
 *  exactly that next overlay. Deliberately narrow: this only factors out the map's own wiring, not
 *  every other overlay's existing hand-rolled useState/keydown pattern (Shop/Inn/Journal/
 *  CharacterMenu/WorldChat stay exactly as they are) - a full unification is a larger, separate
 *  refactor with no clear benefit forced by this task alone. */
export function useMapOverlay(otherOverlaysOpen: boolean): { mapOpen: boolean; toggleMap: () => void; closeMap: () => void } {
  const [mapOpen, setMapOpen] = useState(false);
  const cutsceneActive = useCutsceneStore((s) => s.active !== null);

  function toggleMap() {
    setMapOpen((open) => !open);
  }
  function closeMap() {
    setMapOpen(false);
  }

  // Auto-close on battles is free - CombatScene is a fully separate scene via useSceneStore, so
  // Town/Overworld/Dungeon (and this hook) simply aren't mounted during combat. This effect
  // handles the other cases the spec calls out: cutscenes, and whatever other overlay/dialogue the
  // caller is already tracking in `otherOverlaysOpen`.
  useEffect(() => {
    if (mapOpen && (otherOverlaysOpen || cutsceneActive)) setMapOpen(false);
  }, [mapOpen, otherOverlaysOpen, cutsceneActive]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (e.key !== 'm' && e.key !== 'M') return;
      if (otherOverlaysOpen || cutsceneActive) return;
      toggleMap();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherOverlaysOpen, cutsceneActive]);

  return { mapOpen, toggleMap, closeMap };
}
