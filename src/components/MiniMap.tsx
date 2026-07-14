import { useEffect, useRef, useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { type GridPosition } from '@/hooks/useGridMovement';
import { useMapPreferencesStore } from '@/state/useMapPreferencesStore';
import { getBlockedMessage } from '@/utils/locationGates';
import { ENEMIES, LOCATIONS, NPCS, QUESTS } from '@/data';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';
import type { QuestProgress, TileMap } from '@/types';
import styles from './MiniMap.module.css';

/** Terrain-only walkability for the base tile-grid background color - deliberately NOT the same
 *  check useGridMovement's isWalkable uses for real movement. That function also treats any
 *  `interactable` object's own tile as blocked (you interact with a chest/shrine from an adjacent
 *  tile, not by standing on it) - correct for movement, but wrong for a map overview: it would
 *  paint every interactable's tile as a plain dark "wall" square indistinguishable from a real
 *  wall, and for an unopened chest (deliberately left unmarked so it can't be spotted), that dark
 *  square was exactly the unlabeled black-square artifact being fixed here. The mini-map's
 *  background should reflect real floor-vs-wall terrain (ground tile + discrete collision
 *  obstacles like fences/rocks) only, not momentary "can't stand here right now" occupancy. */
function isTerrainWalkable(map: TileMap, x: number, y: number): boolean {
  const ground = map.layers.find((l) => l.name === 'ground');
  if (!ground) return false;
  const gid = ground.data[y * map.width + x];
  if (gid <= 0 || map.nonWalkableTileIds.includes(gid)) return false;
  const collisionBlocked = map.collisionObjects.some(
    (r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height,
  );
  return !collisionBlocked;
}

interface MiniMapProps {
  map: TileMap;
  position: GridPosition;
  locationId: string;
  openedChests: string[];
  questProgress: Record<string, QuestProgress>;
  onClose: () => void;
}

/** The canvas's own pixel budget (both width and height cap) scales with the viewport instead of
 *  a fixed constant, so the map fills a real, useful portion of the screen on both a small phone
 *  and a large desktop monitor rather than the same fixed 480px square everywhere. Clamped between
 *  a usable floor (MIN_CANVAS_SIZE, even on a small phone) and a ceiling (MAX_CANVAS_SIZE, so it
 *  doesn't balloon absurdly on an ultrawide monitor). */
const MIN_CANVAS_SIZE = 240;
const MAX_CANVAS_SIZE = 900;
const VIEWPORT_WIDTH_FRACTION = 0.92;
const VIEWPORT_HEIGHT_FRACTION = 0.72;
const MIN_CELL_SIZE = 3;
const MAX_CELL_SIZE = 28;

function computeCanvasBudget(): number {
  const budget = Math.min(window.innerWidth * VIEWPORT_WIDTH_FRACTION, window.innerHeight * VIEWPORT_HEIGHT_FRACTION);
  return Math.max(MIN_CANVAS_SIZE, Math.min(MAX_CANVAS_SIZE, Math.floor(budget)));
}

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
/** Generic point-of-interest color: shrines, camps, item-pickup landmarks - anything interactable
 *  that isn't a chest, a building entrance, or a boss. */
const COLOR_LANDMARK = '#9b7ec4';
/** Distinct from COLOR_EXIT_LOCKED - a major boss encoded as an interactable object (see
 *  coalbound-warden) is a point of interest worth calling out, not something to hide; this color
 *  just needs to read as "significant" at a glance, not as a lock-state warning. */
const COLOR_BOSS = '#8b2f2f';

/** Label text for a fixed-size font drawn over the tile grid - dark outline + light fill for
 *  legibility regardless of what's underneath, same outline+fill idea used for floating combat
 *  text elsewhere in this codebase (see battleEffects.ts's playFloatingText), just via canvas
 *  stroke/fill instead of a CSS text-shadow. */
const LABEL_FONT = "10px 'Segoe UI', system-ui, sans-serif";

/** The small set of interactable refIds with neither an ENEMIES nor a LOCATIONS entry of their
 *  own - real, sensible mini-map display names (not the vague in-exploration flavor text those
 *  same refIds get via each scene's own labelForInteractable, which is deliberately mysterious for
 *  an undiscovered interactable you haven't examined yet - the mini-map isn't trying to preserve
 *  that mystery for something already visibly marked on the map). */
const INTERACTABLE_LABEL_FALLBACK: Record<string, string> = {
  'water-fragment': 'Water Fragment',
  'mine-shrine': 'Mine Shrine',
  'ash-hallow-shrine': 'Town Shrine',
  'miners-lost-lantern': "Miner's Lost Lantern",
};

/** Reverse of functions/src/functions/collectWorldItem.ts's WORLD_ITEMS map (itemId -> the
 *  interactable refId that grants it) - a collectItem objective's targetId is an item id, not a
 *  map refId, so a quest like "recover the Stone Fragment from Mossy Creek" needs this to resolve
 *  which on-map landmark to highlight. Every collectItem objective in the game's quest data is one
 *  of these four (verified against quests.ts) - keep in sync by hand if a new one is added. */
const COLLECT_ITEM_LANDMARK_REF_ID: Record<string, string> = {
  'stone-fragment': 'mossy-creek',
  'wind-fragment': 'fallen-watchtower',
  'water-fragment': 'water-fragment',
  'miners-lost-lantern': 'miners-lost-lantern',
};

/** Resolves a mini-map display name + whether this is a major boss (drawn in a distinct color) for
 *  any non-chest interactable refId. Tried in order: ENEMIES (covers boss fights encoded as
 *  interactable objects, e.g. coalbound-warden), then LOCATIONS (covers real landmarks like
 *  Hunter's Camp/Mossy Creek/Spirit Grove/Fallen Watchtower), then the small hardcoded fallback
 *  above. Returns undefined only for a refId nothing above recognizes at all. */
function resolveInteractable(refId: string): { label: string; isBoss: boolean } | undefined {
  const enemy = ENEMIES.find((e) => e.id === refId);
  if (enemy) return { label: enemy.name, isBoss: !!enemy.isBoss };
  const location = LOCATIONS.find((l) => l.id === refId);
  if (location) return { label: location.name, isBoss: false };
  const fallback = INTERACTABLE_LABEL_FALLBACK[refId];
  if (fallback) return { label: fallback, isBoss: false };
  return undefined;
}

/** Player-invoked, canvas-rendered top-down abstraction of the current map - not a second Phaser
 *  instance, since the visual need here (filled rects for walkable/blocked tiles, small dot/icon
 *  markers) is simple enough that standing up a second game engine instance would be disproportionate.
 *  Draws: walkable/blocked terrain (ground tile + discrete collision obstacles only - deliberately
 *  NOT useGridMovement's isWalkable, which also treats every interactable's own tile as blocked for
 *  movement purposes and would otherwise paint an unopened, intentionally-unmarked chest as a bare
 *  dark "wall" square - see isTerrainWalkable), player position+facing, building markers (shop/inn/
 *  apothecary get a distinct color, everything else a generic "building" marker), every other
 *  interactable object with its real name printed next to it (shrines, camps, item-pickup
 *  landmarks, and major bosses like the Coalbound Warden all included - only unopened chests and
 *  regular NPCs stay hidden, plus the wholly separate ephemeral field-encounter icon system, which
 *  this component never reads), area exits (with a lock-state color, per locationGates.ts's binary
 *  story-locked/unlocked model - no key/puzzle/ability taxonomy exists in this codebase to draw a
 *  richer distinction), and selected active-quest markers for reachLocation/interactWithShrine/
 *  collectItem/talkToNpc objectives resolvable on this specific map, gated per-objective on that
 *  objective still being unmet (not just the quest overall being active) - verified against every
 *  objective in every quest's data (see COLLECT_ITEM_LANDMARK_REF_ID and the reachLocation branch
 *  below for the two non-obvious cases: a collectItem target is an item id needing translation to
 *  the landmark that grants it, and a reachLocation target can be either a real cross-map
 *  transition or an in-map landmark interactable, not always the former). talkToNpc is the one
 *  deliberate exception to "no regular NPCs": an NPC who's the unmet target of an active quest
 *  objective gets a real marker+label so the player can find them, since nothing else marks an
 *  NPC's position.
 *  Every marker's name is drawn inline rather than explained via a separate legend. */
export function MiniMap({ map, position, locationId, openedChests, questProgress, onClose }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenQuestIds = useMapPreferencesStore((s) => s.hiddenQuestIds);
  const [canvasBudget, setCanvasBudget] = useState(computeCanvasBudget);
  useOverlayClose(onClose);

  // Recomputed on resize (rotating a phone, resizing a desktop window) - same
  // window.innerWidth/innerHeight-driven convention as useExplorationViewport.ts. A plain listener
  // (no debounce) is fine here, unlike that hook - redrawing this canvas is cheap, not a large
  // TileGrid re-render.
  useEffect(() => {
    function handleResize() {
      setCanvasBudget(computeCanvasBudget());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    // Rebound to a name TS's control-flow narrowing definitely carries into the nested drawMarker
    // function below (narrowing a `const` across a function-declaration boundary isn't guaranteed).
    const ctx: CanvasRenderingContext2D = context;

    const cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.floor(canvasBudget / Math.max(map.width, map.height))));
    const width = map.width * cellSize;
    const height = map.height * cellSize;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Walkable/blocked tile grid.
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        ctx.fillStyle = isTerrainWalkable(map, x, y) ? COLOR_WALKABLE : COLOR_BLOCKED;
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

    // Fixed-size label (not scaled with cellSize, which can be as small as 3px on a large map) -
    // dark outline + light fill for legibility over either the walkable or blocked tile color
    // underneath. Drawn to the right of the marker by default, but flipped to the left when it
    // would otherwise run past the canvas's right edge (measured against this same effect's own
    // `width`) - without this, a landmark near the right side of a wide map got its label clipped
    // by the popup pane instead of just reading on the other side of its marker.
    function drawLabel(x: number, y: number, text: string) {
      const cx = x * cellSize + cellSize / 2;
      const cy = y * cellSize + cellSize / 2;
      const r = Math.max(2, cellSize * 0.4);
      ctx.font = LABEL_FONT;
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(27, 22, 17, 0.9)';
      ctx.fillStyle = '#ece1cf';
      const rightTx = cx + r + 3;
      const wouldOverflow = rightTx + ctx.measureText(text).width > width;
      const tx = wouldOverflow ? cx - r - 3 : rightTx;
      ctx.textAlign = wouldOverflow ? 'right' : 'left';
      ctx.strokeText(text, tx, cy);
      ctx.fillText(text, tx, cy);
    }

    function drawMarkerWithLabel(x: number, y: number, color: string, shape: 'circle' | 'square' | 'diamond', label: string) {
      drawMarker(x, y, color, shape);
      drawLabel(x, y, label);
    }

    // Small quest-gold ring layered on top of a tile's existing marker (rather than a second,
    // separately-labeled marker at the same spot) - keeps both "what is this place" and "there's
    // an active quest here" visible without a duplicate/overlapping label.
    function drawQuestAccent(x: number, y: number) {
      const cx = x * cellSize + cellSize / 2;
      const cy = y * cellSize + cellSize / 2;
      const r = Math.max(2, cellSize * 0.4) + 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = COLOR_QUEST;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Buildings vs. area exits: a transition whose target is a child location of the current one
    // (parentLocationId === locationId) reads as "a building entrance"; every other transition is
    // a true area exit to a different place entirely. Both get their real LOCATIONS name drawn
    // inline now, instead of only being decodable via a separate legend.
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
        drawMarkerWithLabel(obj.x, obj.y, color, 'square', target.name);
      } else {
        const locked = !!getBlockedMessage(obj.refId, questProgress);
        drawMarkerWithLabel(obj.x, obj.y, locked ? COLOR_EXIT_LOCKED : COLOR_EXIT_OPEN, 'diamond', target.name);
      }
    }

    // Opened chests only - an unopened chest is deliberately invisible here, so the mini-map can't
    // spoil undiscovered loot while still helping completion tracking for what's already found.
    for (const obj of map.objects) {
      if (obj.type !== 'interactable' || !obj.refId?.startsWith('chest-')) continue;
      if (!openedChests.includes(obj.refId)) continue;
      drawMarkerWithLabel(obj.x, obj.y, COLOR_CHEST, 'circle', 'Chest');
    }

    // Every other interactable: shrines, camps, item-pickup landmarks, and major bosses like the
    // Coalbound Warden (detected generically via ENEMIES, not a hardcoded refId - see
    // resolveInteractable). Only unopened chests (handled above) and refIds nothing recognizes at
    // all are skipped; regular NPCs and field-encounter icons were never map objects this loop
    // reads to begin with.
    for (const obj of map.objects) {
      if (obj.type !== 'interactable' || !obj.refId || obj.refId.startsWith('chest-')) continue;
      const resolved = resolveInteractable(obj.refId);
      if (!resolved) continue;
      drawMarkerWithLabel(obj.x, obj.y, resolved.isBoss ? COLOR_BOSS : COLOR_LANDMARK, 'circle', resolved.label);
    }

    // Quest markers: reachLocation/interactWithShrine/talkToNpc/collectItem objectives of active
    // quests (the four objective types with a stable position resolvable on a specific map),
    // filtered through the per-quest "Show on Map" toggle (default visible) and, per-objective,
    // only while that specific objective is still unmet - an already-completed objective within an
    // otherwise-active quest (e.g. objective 1 of 3 done, still waiting on 2 and 3) must not keep
    // showing a marker.
    for (const quest of QUESTS) {
      if (hiddenQuestIds.has(quest.id)) continue;
      if (effectiveQuestStatus(quest, questProgress) !== 'active') continue;
      const counts = questProgress[quest.id]?.objectiveCounts ?? {};
      for (const objective of quest.objectives) {
        if ((counts[objective.id] ?? 0) >= objective.requiredCount) continue;
        if (objective.type === 'reachLocation') {
          // A reachLocation target is either a real cross-map transition (e.g. 'ironwood-trail')
          // or a landmark that lives entirely within the current map as an interactable object
          // (e.g. 'spirit-grove', 'hunters-camp' - verified against every shipped map's object
          // data) - both need checking, not just transitions.
          const target = map.objects.find(
            (o) => (o.type === 'transition' || o.type === 'interactable') && o.refId === objective.targetId,
          );
          if (target) drawQuestAccent(target.x, target.y);
        } else if (objective.type === 'interactWithShrine') {
          const shrine = map.objects.find((o) => o.type === 'interactable' && o.refId === objective.targetId);
          if (shrine) drawQuestAccent(shrine.x, shrine.y);
        } else if (objective.type === 'collectItem') {
          // targetId here is an item id, not a map refId (see COLLECT_ITEM_LANDMARK_REF_ID) -
          // resolve to the landmark that actually grants it before looking for a map object.
          const landmarkRefId = COLLECT_ITEM_LANDMARK_REF_ID[objective.targetId];
          const landmark = landmarkRefId
            ? map.objects.find((o) => o.type === 'interactable' && o.refId === landmarkRefId)
            : undefined;
          if (landmark) drawQuestAccent(landmark.x, landmark.y);
        } else if (objective.type === 'talkToNpc') {
          // The one deliberate exception to "no regular NPCs on the mini-map": an NPC who is
          // specifically the unmet target of an active quest objective needs to be findable, so
          // they get a real marker+label (their name) here, not just an accent ring - unlike the
          // other objective types above, there's no earlier loop already drawing something at an
          // NPC's position to layer a ring on top of.
          const npc = map.objects.find((o) => o.type === 'npc' && o.refId === objective.targetId);
          if (npc) {
            const npcName = NPCS.find((n) => n.id === objective.targetId)?.name ?? objective.targetId;
            drawMarkerWithLabel(npc.x, npc.y, COLOR_QUEST, 'circle', npcName);
          } else {
            // The target NPC isn't on this map at all - they may live inside a building that IS
            // on this map (e.g. Ash Hallow's "Visit the General Store" objective actually targets
            // mara-ash, who lives at location ash-hallow-mara-shop, not on the town map itself).
            // Resolve NPC -> their home location's id, then find that location's own building
            // marker on this map (already drawn by the buildings loop above) and accent it -
            // reusing the existing marker instead of drawing a second, redundant one.
            const npcLocationId = NPCS.find((n) => n.id === objective.targetId)?.locationId;
            const building = npcLocationId
              ? map.objects.find((o) => o.type === 'transition' && o.refId === npcLocationId)
              : undefined;
            if (building) drawQuestAccent(building.x, building.y);
          }
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
  }, [map, position, locationId, openedChests, questProgress, hiddenQuestIds, canvasBudget]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <h2 className={styles.title}>Map</h2>
        <canvas ref={canvasRef} className={styles.canvas} />
        <p className={styles.closeHint}>Click outside, press Esc, or press M to close</p>
      </Panel>
    </div>
  );
}
