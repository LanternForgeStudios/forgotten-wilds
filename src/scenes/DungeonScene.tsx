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
import { isTypingTarget } from '@/utils/keyboard';
import { itemDisplayName } from '@/utils/itemName';
import { enemyMapIconScale } from '@/utils/enemyMapIcon';
import { callCollectWorldItem, callOpenChest, callInteractWithShrine } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { playMusic, playSound } from '@/audio/audioService';
import styles from './TownScene.module.css';

const LOCATION_ID = 'hollow-rail-mine';

/** Display name for any interactable on this map, shared between the entity labels and the
 *  "nothing to do here yet" fallback message so they never drift out of sync. */
function labelForInteractable(refId: string, openedChests: string[]): string {
  if (refId.startsWith('chest-')) return openedChests.includes(refId) ? 'Empty Chest' : 'Chest';
  if (refId === 'coalbound-warden') return 'something vast, ember-lit';
  if (refId === 'miners-lost-lantern') return 'Lantern Relic';
  if (refId === 'mine-shrine') return 'Shrine';
  return 'something';
}

export function DungeonScene() {
  const goTo = useSceneStore((s) => s.goTo);
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const questProgress = useQuestStore((s) => s.progress);
  const openedChests = useWorldStateStore((s) => s.openedChests);
  useEffect(() => {
    void playMusic('music.dungeon');
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const isMobile = useIsMobile();
  const hudBarHeight = useHudBarHeight();
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const skin = usePlayerStore((s) => s.player?.skin ?? 'male');
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const otherOverlaysOpen = message !== null || menuOpen || journalOpen;
  const { mapOpen, toggleMap, closeMap } = useMapOverlay(otherOverlaysOpen);
  const suspended = otherOverlaysOpen || mapOpen;
  const { map, position, positionRef, facingDelta, attemptMove, movementState } = useLocationExploration({
    locationId: LOCATION_ID,
    suspended,
    onFieldEncounterStep: (pos) => {
      const icon = consumeFieldEncounterAt(pos.x, pos.y);
      if (icon) goTo('combat', { locationId: LOCATION_ID, spawnX: pos.x, spawnY: pos.y });
    },
    onBlockedTransition: setMessage,
  });
  const { icons: fieldEncounterIcons, consumeAt: consumeFieldEncounterAt } = useFieldEncounters(map, LOCATION_ID, positionRef);

  const { pending, run } = usePendingAction();

  useHeartbeat(uid, displayName, LOCATION_ID, position, skin);
  useDragMovement(gridWrapperRef, attemptMove, isMobile && !suspended);
  const { startDash, stopDash } = useExplorationDash(attemptMove, positionRef, staminaUnlocked && !suspended);

  function attemptInteract() {
    if (suspended || !map) return;
    const { dx, dy } = facingDelta(position.facing);
    const target = { x: position.x + dx, y: position.y + dy };
    const obj = map.objects.find(
      (o) => o.type === 'interactable' && o.x === target.x && o.y === target.y,
    );
    if (obj?.refId === 'miners-lost-lantern') {
      run(() => callCollectWorldItem(LOCATION_ID, 'miners-lost-lantern'), 'Collecting...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          setMessage(
            res.alreadyCollected
              ? "There's nothing left here — you already recovered the lantern."
              : "You pry the battered lantern free of the rubble. It's warm to the touch, as if never truly abandoned.",
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The lantern will not budge.'));
    } else if (obj?.refId === 'coalbound-warden') {
      const ready = questProgress['the-shrine-below']?.status === 'completed';
      if (ready) {
        goTo('combat', {
          locationId: LOCATION_ID,
          bossId: 'coalbound-warden',
          spawnX: position.x,
          spawnY: position.y,
        });
      } else {
        setMessage('Something vast and ember-lit stirs in the dark ahead — but the way feels barred to you, for now.');
      }
    } else if (obj?.refId === 'mine-shrine') {
      run(() => callInteractWithShrine(LOCATION_ID, 'mine-shrine'), 'Interacting with shrine...')
        ?.then(async () => {
          if (uid) await resyncSave(uid);
          void playSound('sfx.shrine');
          setMessage('A shrine carved into the rock, coated in soot. Something in it still resists the corruption around it.');
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The shrine does not respond.'));
    } else if (obj?.refId?.startsWith('chest-')) {
      const chestId = obj.refId;
      run(() => callOpenChest(LOCATION_ID, chestId), 'Opening chest...')
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
        if (o.refId === 'coalbound-warden') {
          return {
            id: o.refId,
            x: o.x,
            y: o.y,
            spriteAssetId: 'battle.enemy.coalbound-warden',
            label: '???',
            displayScale: enemyMapIconScale('battle.enemy.coalbound-warden', true),
          };
        }
        if (o.refId === 'mine-shrine') {
          return { id: o.refId, x: o.x, y: o.y, spriteAssetId: 'structure.shrine', label: 'Shrine' };
        }
        return {
          id: o.refId!,
          x: o.x,
          y: o.y,
          spriteAssetId: o.refId!.startsWith('chest-')
            ? openedChests.includes(o.refId!)
              ? 'structure.chest-open'
              : 'structure.chest'
            : 'icon.item.miners-lost-lantern',
          label: labelForInteractable(o.refId!, openedChests),
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
    // visible marker instead of looking like plain ground - same generic structure.door
    // placeholder TownScene/OverworldScene use for their own exits.
    const exitEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'transition' && o.refId)
      .map((o) => ({ id: `exit-${o.refId}`, x: o.x, y: o.y, spriteAssetId: 'structure.door', label: 'Exit' }));

    return [...interactableEntities, ...exitEntities, ...fieldEncounterEntities];
  }, [map, openedChests, fieldEncounterIcons]);

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Descending into Hollow Rail Mine...</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap} style={{ paddingTop: hudBarHeight }}>
      <PlayerHUD locationId={LOCATION_ID} />
      {pending && <div className={styles.pendingIndicator}>{pending}</div>}
      <div ref={gridWrapperRef} style={{ touchAction: 'none' }}>
        <TileGrid
          map={map}
          player={position}
          playerSpriteAssetId={skin === 'female' ? 'sprite.player.female' : 'sprite.player.male'}
          entities={entities}
          scale={scale}
          viewportSize={viewportSize}
          playerFrameRow={resolveDisplayRow(PLAYER_ANIMATION_LAYOUT, movementState, position.facing)}
          playerMovementState={movementState}
        />
      </div>
      {isMobile ? (
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
          locationId={LOCATION_ID}
          openedChests={openedChests}
          questProgress={questProgress}
          onClose={closeMap}
        />
      )}
    </div>
  );
}
