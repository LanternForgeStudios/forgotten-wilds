import { useEffect, useRef } from 'react';
import { getCurrentMusicId, playMusic } from '@/audio/audioService';

/** Switches to `trackId` the first time `active` becomes true, and restores whatever was playing
 *  before on unmount (panel close, Leave Battle, or the run/duel simply ending) - shared by
 *  EndlessBattlePanel.tsx and PvpBattlePanel.tsx, which are both overlays on top of whichever
 *  exploration scene is mounted (not a scene transition like solo combat's CombatScene.tsx), so
 *  each one must snapshot/restore the prior music track itself rather than relying on a scene
 *  remount to do it. `trackId` only matters the first time `active` flips true (a ref guards
 *  against re-triggering on a later render) - callers that need to pick between tracks (e.g.
 *  EndlessBattlePanel's boss vs. regular combat music) should resolve that before calling. */
export function useCombatMusic(active: boolean, trackId: string): void {
  const previousMusicIdRef = useRef<string | null>(null);
  const combatMusicStartedRef = useRef(false);

  useEffect(() => {
    if (!active || combatMusicStartedRef.current) return;
    combatMusicStartedRef.current = true;
    previousMusicIdRef.current = getCurrentMusicId();
    void playMusic(trackId);
  }, [active, trackId]);

  useEffect(() => {
    return () => {
      if (previousMusicIdRef.current) void playMusic(previousMusicIdRef.current);
    };
  }, []);
}
