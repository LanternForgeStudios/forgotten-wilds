import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { CutsceneScene } from '@/phaser/CutsceneScene';

interface PhaserCutsceneCanvasProps {
  backgroundAssetId: string;
  dramatic?: boolean;
  enemies?: { spriteAssetId: string }[];
  entryEffect?: 'wake-up';
}

/** Full-screen Phaser canvas behind a cutscene's text box - same create-on-mount/destroy-on-
 *  unmount bridge as PhaserBattleCanvas.tsx/PhaserExplorationCanvas.tsx, but sized to the whole
 *  window directly (a plain resize listener) rather than a ResizeObserver on a flex-sized
 *  container, since a cutscene is always a fixed full-viewport overlay, never embedded in a
 *  responsive layout the way the battle stage is. */
export function PhaserCutsceneCanvas({ backgroundAssetId, dramatic, enemies, entryEffect }: PhaserCutsceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CutsceneScene | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    let cancelled = false;
    const scene = new CutsceneScene(() => {
      if (!cancelled) setSceneReady(true);
    });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current ?? undefined,
      width: viewport.width,
      height: viewport.height,
      pixelArt: true,
      backgroundColor: '#0a0806',
      scene,
      banner: false,
    });
    gameRef.current = game;
    sceneRef.current = scene;

    function handleResize() {
      const next = { width: window.innerWidth, height: window.innerHeight };
      setViewport(next);
      sceneRef.current?.setViewport(next);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sceneReady) return;
    let cancelled = false;
    async function run() {
      // entryEffect='wake-up' (defeat cutscene) replaces the plain fade-in with the black->white->
      // image sequence; every other cutscene keeps the default cover-scaled fade-in.
      if (entryEffect === 'wake-up') {
        await sceneRef.current?.playWakeUpSequence(backgroundAssetId, viewport.width, viewport.height);
      } else {
        await sceneRef.current?.loadBackground(backgroundAssetId, viewport.width, viewport.height);
      }
      // Enemy arrivals are sequenced to start after the background is in place, not racing it -
      // and bail if this effect was superseded (a new cutscene started) before the background
      // finished loading.
      if (cancelled || !enemies?.length) return;
      void sceneRef.current?.showEnemyArrivals(enemies);
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, backgroundAssetId, entryEffect]);

  useEffect(() => {
    if (!sceneReady || !dramatic) return;
    sceneRef.current?.playDramaticFlourish();
  }, [sceneReady, dramatic]);

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />;
}
