import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerHUD } from '@/components/PlayerHUD';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { MobileHud } from '@/components/exploration/MobileHud';
import { DirectionPad } from '@/components/exploration/DirectionPad';
import { MessageOverlay } from '@/components/exploration/MessageOverlay';
import { CharacterMenu } from '@/components/CharacterMenu';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { MiniMap } from '@/components/MiniMap';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useFieldEncounters } from '@/hooks/useFieldEncounters';
import { useMapOverlay } from '@/hooks/useMapOverlay';
import { PLAYER_ANIMATION_LAYOUT, resolveDisplayRow } from '@/animation/characterAnimations';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { usePendingAction } from '@/hooks/usePendingAction';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useExplorationViewport, useHudBarHeight } from '@/hooks/useExplorationViewport';
import { useDragMovement } from '@/hooks/useDragMovement';
import { useExplorationDash } from '@/hooks/useExplorationDash';
import { useSceneStore } from '@/state/useSceneStore';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useQuestStore } from '@/state/useQuestStore';
import { useWorldStateStore } from '@/state/useWorldStateStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { useBattleOverlayStore } from '@/state/useBattleOverlayStore';
import { isTypingTarget } from '@/utils/keyboard';
import { itemDisplayName } from '@/utils/itemName';
import { resolveEquipmentLayers, resolvePlayerBaseSpriteAssetId } from '@/utils/equipmentLayers';
import { enemyMapIconScale } from '@/utils/enemyMapIcon';
import { shrineSpriteAssetId } from '@/utils/shrineRestoration';
import { callCollectWorldItem, callOpenChest, callInteractWithShrine } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { playMusic, playSound } from '@/audio/audioService';
import styles from './TownScene.module.css';

/** Which boss a boss-trigger interactable refId starts, keyed by refId (always the same as the
 *  boss's own enemy id, matching the interactable-refId-equals-item-id convention used elsewhere)
 *  - generalized from the single hardcoded 'coalbound-warden' check now that a second dungeon
 *  (Temple of the Deep Current) exists. Each dungeon's own map only ever places its own boss's
 *  refId, so no locationId keying is needed here. */
const BOSS_TRIGGERS: Record<string, { prerequisiteQuestId: string; approachLabel: string; blockedMessage: string }> = {
  'coalbound-warden': {
    prerequisiteQuestId: 'the-shrine-below',
    approachLabel: 'something vast, ember-lit',
    blockedMessage: 'Something vast and ember-lit stirs in the dark ahead — but the way feels barred to you, for now.',
  },
  'ancient-serpent-guardian': {
    prerequisiteQuestId: 'lantern-beneath-still-waters',
    approachLabel: 'something ancient, coiled in the dark water',
    blockedMessage: 'Something ancient stirs in the flooded dark ahead — but the way feels barred to you, for now.',
  },
};

/** Shrine-kind interactables (interactWithShrine.ts), keyed by refId. */
const SHRINE_INTERACTABLES: Record<string, { message: string }> = {
  'mine-shrine': { message: 'A shrine carved into the rock, coated in soot. Something in it still resists the corruption around it.' },
};

/** World-item ("fragment"-kind) interactables (collectWorldItem.ts) - refId is always the same as
 *  the granted item's own id, matching the convention OverworldScene's own fragment table uses.
 *  Sprite ids are reused from an existing thematically-close marker rather than generating new art
 *  for every one-off pickup. */
const WORLD_ITEM_INTERACTABLES: Record<
  string,
  { label: string; foundMessage: string; alreadyMessage: string; dormantSpriteAssetId: string; collectedSpriteAssetId: string }
> = {
  'miners-lost-lantern': {
    label: 'Lantern Relic',
    foundMessage: "You pry the battered lantern free of the rubble. It's warm to the touch, as if never truly abandoned.",
    alreadyMessage: "There's nothing left here — you already recovered the lantern.",
    dormantSpriteAssetId: 'structure.lantern-relic-dormant',
    collectedSpriteAssetId: 'structure.lantern-relic-collected',
  },
  'temple-records': {
    label: 'Temple Records',
    foundMessage: 'You recover a stack of waterlogged records, miraculously still legible.',
    alreadyMessage: "There's nothing left here — you already recovered the records.",
    dormantSpriteAssetId: 'structure.chest',
    collectedSpriteAssetId: 'structure.chest-open',
  },
  'lantern-of-still-waters': {
    label: 'Lantern Sanctuary',
    foundMessage: 'A lantern rests here, unlit but unmistakably legendary. You lift it free.',
    alreadyMessage: "There's nothing left here — you already claimed the lantern.",
    dormantSpriteAssetId: 'structure.lantern-relic-dormant',
    collectedSpriteAssetId: 'structure.lantern-relic-collected',
  },
};

/** Display name for any interactable on this map, shared between the entity labels and the
 *  "nothing to do here yet" fallback message so they never drift out of sync. */
function labelForInteractable(refId: string, openedChests: string[]): string {
  if (refId.startsWith('chest-')) return openedChests.includes(refId) ? 'Empty Chest' : 'Chest';
  if (BOSS_TRIGGERS[refId]) return BOSS_TRIGGERS[refId].approachLabel;
  if (WORLD_ITEM_INTERACTABLES[refId]) return WORLD_ITEM_INTERACTABLES[refId].label;
  if (SHRINE_INTERACTABLES[refId]) return 'Shrine';
  if (refId.startsWith('glowing-mushroom')) return 'Glowing Mushroom';
  return 'something';
}

export function DungeonScene() {
  const goTo = useSceneStore((s) => s.goTo);
  // Defaults to Hollow Rail Mine (the only dungeon that existed before this was generalized) so
  // any stale/direct navigation without params still lands somewhere real - same fallback
  // convention OverworldScene's own locationId already uses.
  const locationId = useSceneStore((s) => s.params.locationId) ?? 'hollow-rail-mine';
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const questProgress = useQuestStore((s) => s.progress);
  const openedChests = useWorldStateStore((s) => s.openedChests);
  // A world-item ("fragment"-kind) interactable is granted to inventory once and never removed/
  // consumed (see collectWorldItem.ts), so its presence there is a reliable "already collected"
  // signal for swapping its map marker to a collected-state sprite - same idea as openedChests
  // above, just derived from inventory instead of a dedicated Firestore list.
  const inventory = useInventoryStore((s) => s.items);
  const isWorldItemCollected = (refId: string) => inventory.some((i) => i.itemId === refId);
  useEffect(() => {
    void playMusic('music.dungeon');
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const isMobile = useIsMobile();
  const battleOverlayOpen = useBattleOverlayStore((s) => s.isOpen);
  const hudBarHeight = useHudBarHeight();
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const gender = usePlayerStore((s) => s.player?.gender ?? 'male');
  const appearance = usePlayerStore((s) => s.player?.appearance ?? 'white-dark');
  const equipment = usePlayerStore((s) => s.player?.equipment);
  const equipmentLayers = useMemo(() => resolveEquipmentLayers(equipment, gender), [equipment, gender]);
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const otherOverlaysOpen = message !== null || menuOpen || journalOpen;
  const { mapOpen, toggleMap, closeMap } = useMapOverlay(otherOverlaysOpen);
  const suspended = otherOverlaysOpen || mapOpen;
  const { map, position, positionRef, facingDelta, attemptMove, movementState } = useLocationExploration({
    locationId,
    suspended,
    onFieldEncounterStep: (pos) => {
      const icon = consumeFieldEncounterAt(pos.x, pos.y);
      if (icon) goTo('combat', { locationId, spawnX: pos.x, spawnY: pos.y });
    },
    onBlockedTransition: setMessage,
  });
  const { icons: fieldEncounterIcons, consumeAt: consumeFieldEncounterAt } = useFieldEncounters(map, locationId, positionRef);

  const { pending, run } = usePendingAction();

  useHeartbeat(uid, displayName, locationId, position, gender);
  useDragMovement(gridWrapperRef, attemptMove, isMobile && !suspended);
  const { startDash, stopDash } = useExplorationDash(attemptMove, positionRef, staminaUnlocked && !suspended);

  function attemptInteract() {
    if (suspended || !map) return;
    const { dx, dy } = facingDelta(position.facing);
    const target = { x: position.x + dx, y: position.y + dy };
    const obj = map.objects.find(
      (o) => o.type === 'interactable' && o.x === target.x && o.y === target.y,
    );
    const worldItem = obj?.refId ? WORLD_ITEM_INTERACTABLES[obj.refId] : undefined;
    const bossTrigger = obj?.refId ? BOSS_TRIGGERS[obj.refId] : undefined;
    const shrine = obj?.refId ? SHRINE_INTERACTABLES[obj.refId] : undefined;
    if (worldItem && obj?.refId) {
      const refId = obj.refId;
      run(() => callCollectWorldItem(locationId, refId), 'Collecting...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          setMessage(res.alreadyCollected ? worldItem.alreadyMessage : worldItem.foundMessage);
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'It will not budge.'));
    } else if (bossTrigger && obj?.refId) {
      const bossId = obj.refId;
      const ready = questProgress[bossTrigger.prerequisiteQuestId]?.status === 'completed';
      if (ready) {
        goTo('combat', {
          locationId,
          bossId,
          spawnX: position.x,
          spawnY: position.y,
        });
      } else {
        setMessage(bossTrigger.blockedMessage);
      }
    } else if (shrine && obj?.refId) {
      const refId = obj.refId;
      run(() => callInteractWithShrine(locationId, refId), 'Interacting with shrine...')
        ?.then(async () => {
          if (uid) await resyncSave(uid);
          void playSound('sfx.shrine');
          setMessage(shrine.message);
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The shrine does not respond.'));
    } else if (obj?.refId?.startsWith('chest-')) {
      const chestId = obj.refId;
      run(() => callOpenChest(locationId, chestId), 'Opening chest...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          if (!res.alreadyOpened) void playSound('sfx.chest-open');
          const name = itemDisplayName(res.itemId);
          setMessage(
            res.alreadyOpened
              ? 'You already emptied this chest.'
              : `You open the chest and find ${name}!`,
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The chest will not open.'));
    } else if (obj?.refId) {
      const label = labelForInteractable(obj.refId, openedChests);
      const article = label.startsWith('Empty') ? 'an ' : 'a ';
      setMessage(`You find ${article}${label.toLowerCase()}. Perhaps it will mean something, in time.`);
    }
  }

  useEffect(() => {
    function handleInteract(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (e.key === 'Escape') {
        if (message) setMessage(null);
        else if (menuOpen) setMenuOpen(false);
        else if (journalOpen) setJournalOpen(false);
        return;
      }
      if (e.key === 'i' || e.key === 'I') {
        setMenuOpen((open) => !open);
        return;
      }
      if (e.key === 'j' || e.key === 'J') {
        setJournalOpen((open) => !open);
        return;
      }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      attemptInteract();
    }
    window.addEventListener('keydown', handleInteract);
    return () => window.removeEventListener('keydown', handleInteract);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, menuOpen, journalOpen, map, position, facingDelta, uid, questProgress, goTo]);

  // Memoized so a re-render caused by unrelated state (message/menuOpen/etc.) doesn't hand
  // TileGrid a brand-new array reference every time - PhaserExplorationCanvas re-runs
  // setEntities(entities) whenever this reference changes, which is wasted work when nothing
  // about the entities themselves actually changed. Must run unconditionally (before the `!map`
  // early return below) - hooks can never be skipped on some renders and not others.
  const entities = useMemo<GridEntity[]>(() => {
    if (!map) return [];
    const interactableEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'interactable' && o.refId)
      .map((o) => {
        const refId = o.refId!;
        const bossTrigger = BOSS_TRIGGERS[refId];
        if (bossTrigger) {
          const spriteAssetId = `battle.enemy.${refId}`;
          return {
            id: refId,
            x: o.x,
            y: o.y,
            spriteAssetId,
            label: '???',
            displayScale: enemyMapIconScale(spriteAssetId, true),
          };
        }
        if (SHRINE_INTERACTABLES[refId]) {
          return {
            id: refId,
            x: o.x,
            y: o.y,
            spriteAssetId: shrineSpriteAssetId(refId, questProgress),
            label: 'Shrine',
          };
        }
        if (refId.startsWith('glowing-mushroom')) {
          return { id: refId, x: o.x, y: o.y, spriteAssetId: 'structure.decor-glowing-mushroom', label: 'Glowing Mushroom' };
        }
        const worldItem = WORLD_ITEM_INTERACTABLES[refId];
        if (worldItem) {
          const collected = isWorldItemCollected(refId);
          return {
            id: refId,
            x: o.x,
            y: o.y,
            spriteAssetId: collected ? worldItem.collectedSpriteAssetId : worldItem.dormantSpriteAssetId,
            label: collected ? 'Empty Alcove' : worldItem.label,
          };
        }
        return {
          id: refId,
          x: o.x,
          y: o.y,
          spriteAssetId: openedChests.includes(refId) ? 'structure.chest-open' : 'structure.chest',
          label: labelForInteractable(refId, openedChests),
        };
      });

    const fieldEncounterEntities: GridEntity[] = fieldEncounterIcons.map((icon) => ({
      id: icon.id,
      x: icon.x,
      y: icon.y,
      spriteAssetId: icon.spriteAssetId,
      displayScale: enemyMapIconScale(icon.spriteAssetId, icon.isBoss),
    }));

    // Every transition (the entrance from Black Briar Forest, the exit to the Mine Office) gets a
    // visible pulsing exit marker instead of looking like plain ground - same generic marker
    // TownScene/OverworldScene use for their own exits.
    const exitEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'transition' && o.refId)
      .map((o) => ({ id: `exit-${o.refId}`, x: o.x, y: o.y, spriteAssetId: 'structure.exit-marker', label: 'Exit' }));

    return [...interactableEntities, ...exitEntities, ...fieldEncounterEntities];
  }, [map, openedChests, fieldEncounterIcons, questProgress, inventory]);

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Descending...</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap} style={{ paddingTop: hudBarHeight }}>
      <PlayerHUD locationId={locationId} />
      {pending && <div className={styles.pendingIndicator}>{pending}</div>}
      <div ref={gridWrapperRef} style={{ touchAction: 'none' }}>
        <TileGrid
          map={map}
          player={position}
          playerSpriteAssetId={resolvePlayerBaseSpriteAssetId(gender, appearance)}
          entities={entities}
          scale={scale}
          viewportSize={viewportSize}
          playerFrameRow={resolveDisplayRow(PLAYER_ANIMATION_LAYOUT, movementState, position.facing)}
          playerMovementState={movementState}
          equipmentLayers={equipmentLayers}
        />
      </div>
      {/* Hidden entirely while a battle panel is open (mobile controls included) - see
          useBattleOverlayStore's own doc comment; the near-full-screen battle panel leaves no room
          for these and mobile's touch controls would otherwise sit uselessly (and confusingly)
          underneath it. */}
      {battleOverlayOpen ? null : isMobile ? (
        <>
          <DirectionPad attemptMove={attemptMove} />
          <MobileHud
            onInteract={attemptInteract}
            onDashStart={staminaUnlocked ? () => startDash() : undefined}
            onDashStop={staminaUnlocked ? stopDash : undefined}
            onInventory={() => setMenuOpen((open) => !open)}
            onJournal={() => setJournalOpen((open) => !open)}
            onMap={toggleMap}
          />
        </>
      ) : (
        <p className={styles.hint}>
          Move: arrow keys / WASD &nbsp;·&nbsp; Interact: Enter / Space
          {staminaUnlocked && <>&nbsp;·&nbsp; Dash: hold Shift</>}
          &nbsp;·&nbsp; Inventory: I &nbsp;·&nbsp; Journal: J &nbsp;·&nbsp; Map: M
        </p>
      )}
      <MessageOverlay message={message} onClose={() => setMessage(null)} />
      {menuOpen && <CharacterMenu onClose={() => setMenuOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
      {mapOpen && (
        <MiniMap
          map={map}
          position={position}
          locationId={locationId}
          openedChests={openedChests}
          questProgress={questProgress}
          onClose={closeMap}
        />
      )}
    </div>
  );
}
