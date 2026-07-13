import { useEffect, useRef } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { isWalkable, type GridPosition } from '@/hooks/useGridMovement';
import { useMapPreferencesStore } from '@/state/useMapPreferencesStore';
import { getBlockedMessage } from '@/utils/locationGates';
import { LOCATIONS, QUESTS } from '@/data';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';
import type { QuestProgress, TileMap } from '@/types';
import styles from './MiniMap.module.css';

interface MiniMapProps {
  map: TileMap;
  position: GridPosition;
  locationId: string;
  openedChests: string[];
  questProgress: Record<string, QuestProgress>;
  onClose: () => void;
}

const MAX_CANVAS_SIZE = 480;
const MIN_CELL_SIZE = 3;
const MAX_CELL_SIZE = 28;

const COLOR_WALKABLE = '#3a2f22';
const COLOR_BLOCKED = '#151109';
const COLOR_PLAYER = '#e0a94a';
const COLOR_BUILDING = '#7a94a8';
const COLOR_SHOP = '#5fa85f';
const COLOR_INN = '#a85fa8';
const COLOR_APOTHECARY = '#5fa8a8';
const COLOR_EXIT_OPEN = '#ece1cf';
const COLOR_EXIT_LOCKED = '#c0392b';
const COLOR_CHEST = '#e0a94a';
const COLOR_QUEST = '#ffd166';

/** Player-invoked, canvas-rendered top-down abstraction of the current map - not a second Phaser
 *  instance, since the visual need here (filled rects for walkable/blocked tiles, small dot/icon
 *  markers) is simple enough that standing up a second game engine instance would be disproportionate.
 *  Draws: walkable/blocked tiles, player position+facing, building markers (shop/inn/apothecary get
 *  a distinct color, everything else a generic "building" marker), opened-chest markers (unopened
 *  chests are never shown, so this can't spoil undiscovered loot), area exits (with a lock-state
 *  color, per locationGates.ts's binary story-locked/unlocked model - no key/puzzle/ability
 *  taxonomy exists in this codebase to draw a richer distinction), and selected active-quest
 *  markers for reachLocation/interactWithShrine objectives resolvable on this specific map. */
export function MiniMap({ map, position, locationId, openedChests, questProgress, onClose }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenQuestIds = useMapPreferencesStore((s) => s.hiddenQuestIds);
  useOverlayClose(onClose);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    // Rebound to a name TS's control-flow narrowing definitely carries into the nested drawMarker
    // function below (narrowing a `const` across a function-declaration boundary isn't guaranteed).
    const ctx: CanvasRenderingContext2D = context;

    const cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.floor(MAX_CANVAS_SIZE / Math.max(map.width, map.height))));
    const width = map.width * cellSize;
    const height = map.height * cellSize;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Walkable/blocked tile grid.
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        ctx.fillStyle = isWalkable(map, x, y) ? COLOR_WALKABLE : COLOR_BLOCKED;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    function drawMarker(x: number, y: number, color: string, shape: 'circle' | 'square' | 'diamond' = 'square') {
      const cx = x * cellSize + cellSize / 2;
      const cy = y * cellSize + cellSize / 2;
      const r = Math.max(2, cellSize * 0.4);
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      }
    }

    // Buildings vs. area exits: a transition whose target is a child location of the current one
    // (parentLocationId === locationId) reads as "a building entrance"; every other transition is
    // a true area exit to a different place entirely.
    for (const obj of map.objects) {
      if (obj.type !== 'transition' || !obj.refId) continue;
      const target = LOCATIONS.find((l) => l.id === obj.refId);
      if (!target) continue;
      if (target.parentLocationId === locationId) {
        const color =
          target.buildingKind === 'shop'
            ? COLOR_SHOP
            : target.buildingKind === 'inn'
              ? COLOR_INN
              : target.buildingKind === 'apothecary'
                ? COLOR_APOTHECARY
                : COLOR_BUILDING;
        drawMarker(obj.x, obj.y, color, 'square');
      } else {
        const locked = !!getBlockedMessage(obj.refId, questProgress);
        drawMarker(obj.x, obj.y, locked ? COLOR_EXIT_LOCKED : COLOR_EXIT_OPEN, 'diamond');
      }
    }

    // Opened chests only - an unopened chest is deliberately invisible here, so the mini-map can't
    // spoil undiscovered loot while still helping completion tracking for what's already found.
    for (const obj of map.objects) {
      if (obj.type !== 'interactable' || !obj.refId?.startsWith('chest-')) continue;
      if (!openedChests.includes(obj.refId)) continue;
      drawMarker(obj.x, obj.y, COLOR_CHEST, 'circle');
    }

    // Quest markers: only reachLocation/interactWithShrine objectives of active quests (the two
    // objective types with a stable position resolvable on a specific map), filtered through the
    // per-quest "Show on Map" toggle (default visible).
    for (const quest of QUESTS) {
      if (hiddenQuestIds.has(quest.id)) continue;
      if (effectiveQuestStatus(quest, questProgress) !== 'active') continue;
      for (const objective of quest.objectives) {
        if (objective.type === 'reachLocation') {
          const transition = map.objects.find((o) => o.type === 'transition' && o.refId === objective.targetId);
          if (transition) drawMarker(transition.x, transition.y, COLOR_QUEST, 'diamond');
        } else if (objective.type === 'interactWithShrine') {
          const shrine = map.objects.find((o) => o.type === 'interactable' && o.refId === objective.targetId);
          if (shrine) drawMarker(shrine.x, shrine.y, COLOR_QUEST, 'diamond');
        }
      }
    }

    // Player position + a short facing tick.
    const px = position.x * cellSize + cellSize / 2;
    const py = position.y * cellSize + cellSize / 2;
    ctx.fillStyle = COLOR_PLAYER;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(3, cellSize * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b1611';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const facingDelta: Record<GridPosition['facing'], [number, number]> = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };
    const [fdx, fdy] = facingDelta[position.facing];
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + fdx * cellSize, py + fdy * cellSize);
    ctx.strokeStyle = COLOR_PLAYER;
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [map, position, locationId, openedChests, questProgress, hiddenQuestIds]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <h2 className={styles.title}>Map</h2>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.legend}>
          <span><i className={styles.swatch} style={{ background: COLOR_PLAYER, borderRadius: '50%' }} /> You</span>
          <span><i className={styles.swatch} style={{ background: COLOR_BUILDING }} /> Building</span>
          <span><i className={styles.swatch} style={{ background: COLOR_SHOP }} /> Shop</span>
          <span><i className={styles.swatch} style={{ background: COLOR_INN }} /> Inn</span>
          <span><i className={styles.swatch} style={{ background: COLOR_APOTHECARY }} /> Apothecary</span>
          <span><i className={styles.swatch} style={{ background: COLOR_EXIT_OPEN }} /> Exit</span>
          <span><i className={styles.swatch} style={{ background: COLOR_EXIT_LOCKED }} /> Locked exit</span>
          <span><i className={styles.swatch} style={{ background: COLOR_CHEST, borderRadius: '50%' }} /> Opened chest</span>
          <span><i className={styles.swatch} style={{ background: COLOR_QUEST }} /> Quest</span>
        </div>
        <p className={styles.closeHint}>Click outside, press Esc, or press M to close</p>
      </Panel>
    </div>
  );
}
