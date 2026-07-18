import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { BattleScene, type BattleEnemyVisual } from '@/phaser/BattleScene';
import type { CombatHitResult, EnemyHitResult } from '@/firebase/functionsClient';

export type { BattleEnemyVisual };

interface PhaserBattleCanvasProps {
  backgroundAssetId: string;
  enemies: BattleEnemyVisual[];
  outgoingHits: (CombatHitResult & { key: number })[];
  incomingHits: (EnemyHitResult & { key: number })[];
  playerMaxHp: number;
  /** Player's per-encounter toggle - collapses the stagger between multiple enemies' attacks so a
   *  round plays out (and log lines reveal) all at once instead of one attacker at a time. */
  fastRounds: boolean;
  targetIndex: number | null;
  targetMode: 'single' | 'all';
  canPickTarget: boolean;
  onTargetEnemy: (index: number) => void;
  /** True once the fight has reached victory/defeat/fled/error - tells the Scene to stop every
   *  tween/emitter so the arena isn't idly animating behind the overlay Panel, without unmounting
   *  this component (the Phaser.Game instance survives until CombatScene itself unmounts via
   *  returnToExploration()). */
  combatEnded: boolean;
  /** The player's active ailment ids as of the most recently resolved round, plus a `key` that
   *  changes every round (even if the ailment list itself didn't) - BattleScene.playAilmentEffects
   *  fires a fresh FX-pack burst per still-active DoT ailment each round, so this needs to
   *  re-trigger on `key` alone rather than on ailmentIds' own (possibly-unchanged) identity.
   *  `key === 0` is the pre-first-round sentinel and is skipped. */
  ailmentFxEvent: { ailmentIds: string[]; key: number };
  /** Only the ailment ids newly inflicted this round (already-active/still-ticking ailments are
   *  excluded - see ailmentFxEvent above for those) - triggers BattleScene's bigger, multi-burst
   *  "this just took hold" moment instead of the quieter per-round reapplication burst. Same
   *  key-changes-every-round shape as ailmentFxEvent, for the same reason. */
  ailmentTakesHoldEvent: { ailmentIds: string[]; key: number };
  /** The enemy-side equivalent of ailmentTakesHoldEvent - one entry per enemy that had a new
   *  ailment land on it this round (e.g. Ember Burst's Burn succeeding against a vulnerable
   *  enemy), each bursting that ailment's FX directly on that enemy's own sprite instead of the
   *  whole-arena scatter the player's own ailments use. Same key-changes-every-round convention. */
  enemyAilmentTakesHoldEvent: { entries: { enemyIndex: number; ailmentIds: string[] }[]; key: number };
}

/** Phaser-backed battle stage - background, enemy formation, HP bars, hit/defeat effects. Same
 *  create-on-mount/destroy-on-unmount bridge pattern as
 *  src/components/exploration/PhaserExplorationCanvas.tsx, but sized by a ResizeObserver on its
 *  own container instead of a purpose-built viewport hook, since `.enemyArea` (its parent) is a
 *  responsive flex region, not a fixed pixel size the way exploration's viewport is - the
 *  Phaser.Game itself isn't constructed until the first real (nonzero) measurement arrives, so
 *  there's no wrong-size-then-resize flash. CombatScene.tsx keeps owning all fight state (phase,
 *  enemies, hits, targeting) - this component and BattleScene are pure rendering, same "Phaser
 *  owns canvas, React owns menus" split already proven for exploration. */
export function PhaserBattleCanvas(props: PhaserBattleCanvasProps) {
  const {
    backgroundAssetId,
    enemies,
    outgoingHits,
    incomingHits,
    playerMaxHp,
    fastRounds,
    targetIndex,
    targetMode,
    canPickTarget,
    onTargetEnemy,
    combatEnded,
    ailmentFxEvent,
    ailmentTakesHoldEvent,
    enemyAilmentTakesHoldEvent,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const hasLoadedEncounterRef = useRef(false);
  const onTargetEnemyRef = useRef(onTargetEnemy);
  onTargetEnemyRef.current = onTargetEnemy;

  // Creates the Game exactly once, then a ResizeObserver keeps it sized to the container from then
  // on. The container's size is checked synchronously first (getBoundingClientRect) so the Game
  // can be created on the very first effect run rather than always waiting a frame for the
  // observer's own (asynchronous) first callback.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    const createGame = (width: number, height: number) => {
      const scene = new BattleScene(
        () => {
          if (!cancelled) setSceneReady(true);
        },
        (index) => onTargetEnemyRef.current(index),
      );
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: container,
        width,
        height,
        pixelArt: true,
        transparent: true,
        scene,
        banner: false,
      });
      gameRef.current = game;
      sceneRef.current = scene;
    };

    const initialRect = container.getBoundingClientRect();
    if (initialRect.width > 0 && initialRect.height > 0) {
      createGame(initialRect.width, initialRect.height);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;

      if (!gameRef.current) {
        createGame(width, height);
      } else if (hasLoadedEncounterRef.current) {
        // Resizing mid-boot (before loadEncounter has laid anything out) raced with Phaser's own
        // async scene init and left the canvas rendering nothing at all - confirmed by hand: a
        // cold-cache first mount (slow texture fetch, wide window for this observer's guaranteed
        // "report current size" callback to land before `create()` finished) reliably went black,
        // while a warm-cache remount (fast enough to dodge the race) didn't. ResizeObserver always
        // fires at least once right after observe() even when nothing has visually changed, so
        // gating on hasLoadedEncounterRef defers that report until there's actually a laid-out
        // scene worth resizing - background/formation are still only computed once at loadEncounter
        // time (BattleScene.setViewport's own doc comment), so a real resize during that window
        // would've been a no-op for the enemy layout anyway.
        sceneRef.current?.setViewport({ width, height });
      }
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
      setSceneReady(false);
      hasLoadedEncounterRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // loadEncounter is only ever called once per BattleScene instance's life - the roster is fixed
  // for the fight's lifetime (see the migration plan's risk assessment). Subsequent enemies
  // updates (hp changes each round) go through syncEnemies below instead.
  useEffect(() => {
    if (!sceneReady || hasLoadedEncounterRef.current || enemies.length === 0) return;
    hasLoadedEncounterRef.current = true;
    sceneRef.current?.loadEncounter(backgroundAssetId, enemies).catch((err) => {
      // Without this, a failure here (bad asset id, texture load error) is a silent unhandled
      // promise rejection - the arena just stays blank with no visible error, since this is the
      // only call site that invokes loadEncounter.
      console.error('[PhaserBattleCanvas] loadEncounter failed:', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, enemies.length]);

  useEffect(() => {
    if (!sceneReady || !hasLoadedEncounterRef.current) return;
    sceneRef.current?.syncEnemies(enemies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, enemies]);

  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.setTargeting(targetIndex, targetMode, canPickTarget);
  }, [sceneReady, targetIndex, targetMode, canPickTarget]);

  useEffect(() => {
    if (!sceneReady || outgoingHits.length === 0) return;
    sceneRef.current?.playOutgoingHits(outgoingHits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, outgoingHits]);

  useEffect(() => {
    if (!sceneReady || incomingHits.length === 0) return;
    sceneRef.current?.playIncomingHits(incomingHits, playerMaxHp, fastRounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, incomingHits]);

  useEffect(() => {
    if (!sceneReady || !combatEnded) return;
    sceneRef.current?.clear();
  }, [sceneReady, combatEnded]);

  useEffect(() => {
    if (!sceneReady || ailmentFxEvent.key === 0) return;
    sceneRef.current?.playAilmentEffects(ailmentFxEvent.ailmentIds).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, ailmentFxEvent.key]);

  useEffect(() => {
    if (!sceneReady || ailmentTakesHoldEvent.key === 0 || ailmentTakesHoldEvent.ailmentIds.length === 0) return;
    sceneRef.current?.playAilmentTakesHold(ailmentTakesHoldEvent.ailmentIds).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, ailmentTakesHoldEvent.key]);

  useEffect(() => {
    if (!sceneReady || enemyAilmentTakesHoldEvent.key === 0) return;
    for (const entry of enemyAilmentTakesHoldEvent.entries) {
      sceneRef.current?.playEnemyAilmentTakesHold(entry.enemyIndex, entry.ailmentIds).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, enemyAilmentTakesHoldEvent.key]);

  // position:absolute + inset:0 against .battleCanvasWrap's own position:relative, not
  // width/height:100% - a flex item sized only by flex-grow/min-height (no explicit `height`) is
  // not a "definite" height for percentage-height resolution purposes in every browser, so a
  // height:100% child can collapse to 0 even though the parent visually renders with real height
  // (confirmed by hand: getBoundingClientRect() on this div measured height:0 while its parent's
  // min-height:200px + flex:1 was very much in effect). Absolute positioning against the nearest
  // positioned ancestor's padding box sidesteps that resolution question entirely.
  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
