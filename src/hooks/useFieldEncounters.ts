import { useEffect, useRef, useState } from 'react';
import type { TileMap } from '@/types';
import type { GridPosition } from './useGridMovement';
import { isWalkable } from './useGridMovement';
import { LOCATIONS, ENEMIES } from '@/data';

export interface FieldEncounterIcon {
  id: string;
  x: number;
  y: number;
  enemyId: string;
  spriteAssetId: string;
  /** Whether this icon's enemy is a boss - field encounters never actually roll a boss today (see
   *  data/locations.ts's encounterTable), but this is still resolved here rather than assumed, so
   *  the map-icon scale (see utils/enemyMapIcon.ts) stays correct if that ever changes. */
  isBoss: boolean;
}

const MIN_ICONS = 8;
const MAX_ICONS = 12;
const MIN_RESPAWN_MS = 5 * 60_000;
const MAX_RESPAWN_MS = 8 * 60_000;
/** Minimum Chebyshev distance kept between two field-encounter icons, so a fresh spawn set reads
 *  as "spread out" rather than clumped. */
const MIN_ICON_SPACING = 4;
/** Minimum distance from the player's current tile - avoids a fresh set (initial load or a
 *  respawn) landing directly on top of the player. */
const MIN_DISTANCE_FROM_PLAYER = 3;
const MAX_PLACEMENT_ATTEMPTS = 300;

/** Simple weighted-random pick, same shape as the server's own rollEnemyForLocation - this pick is
 *  cosmetic only (which sprite the field icon shows), never sent to startEncounter, which
 *  independently rolls its own real roster server-side. */
function weightedPick(table: { enemyId: string; weight: number }[]): string | undefined {
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return undefined;
  let roll = Math.random() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.enemyId;
  }
  return table[table.length - 1]?.enemyId;
}

function generateIcons(
  map: TileMap,
  encounterTable: { enemyId: string; weight: number }[],
  player: { x: number; y: number },
): FieldEncounterIcon[] {
  const targetCount = MIN_ICONS + Math.floor(Math.random() * (MAX_ICONS - MIN_ICONS + 1));
  // Never place an icon directly on a spawn point, transition, npc, or interactable - those tiles
  // are already walkable per isWalkable, but visually overlapping a door/chest/NPC would be
  // confusing regardless.
  const occupied = new Set(
    map.objects
      .filter((o) => o.type === 'spawnPoint' || o.type === 'transition' || o.type === 'npc' || o.type === 'interactable')
      .map((o) => `${o.x}:${o.y}`),
  );

  const icons: FieldEncounterIcon[] = [];
  let attempts = 0;
  while (icons.length < targetCount && attempts < MAX_PLACEMENT_ATTEMPTS) {
    attempts++;
    const x = Math.floor(Math.random() * map.width);
    const y = Math.floor(Math.random() * map.height);
    if (occupied.has(`${x}:${y}`)) continue;
    if (!isWalkable(map, x, y)) continue;
    if (Math.max(Math.abs(x - player.x), Math.abs(y - player.y)) < MIN_DISTANCE_FROM_PLAYER) continue;
    const tooCloseToAnother = icons.some(
      (icon) => Math.max(Math.abs(x - icon.x), Math.abs(y - icon.y)) < MIN_ICON_SPACING,
    );
    if (tooCloseToAnother) continue;

    const enemyId = weightedPick(encounterTable);
    if (!enemyId) continue;
    const enemyDef = ENEMIES.find((e) => e.id === enemyId);
    const spriteAssetId = enemyDef?.battleSpriteAssetId ?? '';
    icons.push({
      id: `field-encounter-${x}-${y}-${Date.now()}-${icons.length}`,
      x,
      y,
      enemyId,
      spriteAssetId,
      isBoss: !!enemyDef?.isBoss,
    });
  }
  // A small/dense map may legitimately not fit the full target count - that's fine, don't force it.
  return icons;
}

/** Visible, player-avoidable enemy icons scattered across an encounter-supporting location's
 *  walkable tiles - replaces the old invisible per-tile probability roll (see
 *  useLocationExploration's removed onEncounterZoneStep). Modeled on useWanderingNpcs.ts's
 *  "ephemeral, client-only, per-map entity state" shape: a plain useState, no Zustand store, no
 *  server call. Two players in the same location see independently-randomized icon sets - this is
 *  cosmetic/random and doesn't need reload-persistence or cross-client sync. */
export function useFieldEncounters(
  map: TileMap | null,
  locationId: string,
  positionRef: React.RefObject<GridPosition>,
): { icons: FieldEncounterIcon[]; consumeAt: (x: number, y: number) => FieldEncounterIcon | undefined } {
  const [icons, setIcons] = useState<FieldEncounterIcon[]>([]);
  const iconsRef = useRef(icons);
  iconsRef.current = icons;
  const encounterTable = LOCATIONS.find((l) => l.id === locationId)?.encounterTable ?? [];
  const encounterTableKey = encounterTable.map((e) => `${e.enemyId}:${e.weight}`).join('|');

  useEffect(() => {
    if (!map || encounterTable.length === 0) {
      setIcons([]);
      return;
    }
    setIcons(generateIcons(map, encounterTable, positionRef.current));

    let timeoutId: ReturnType<typeof window.setTimeout>;
    function scheduleRespawn() {
      const delay = MIN_RESPAWN_MS + Math.random() * (MAX_RESPAWN_MS - MIN_RESPAWN_MS);
      timeoutId = window.setTimeout(() => {
        if (map) setIcons(generateIcons(map, encounterTable, positionRef.current));
        scheduleRespawn();
      }, delay);
    }
    scheduleRespawn();
    return () => window.clearTimeout(timeoutId);
    // Deliberately keyed on locationId/encounterTableKey (not the map/encounterTable object
    // references, which are stable-but-not-guaranteed, and not positionRef, which changes every
    // step) - only a real location change should reroll the whole spawn cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, locationId, encounterTableKey]);

  function consumeAt(x: number, y: number): FieldEncounterIcon | undefined {
    const icon = iconsRef.current.find((i) => i.x === x && i.y === y);
    if (icon) setIcons((prev) => prev.filter((i) => i.id !== icon.id));
    return icon;
  }

  return { icons, consumeAt };
}
