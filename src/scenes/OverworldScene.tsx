import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerHUD } from '@/components/PlayerHUD';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { MobileHud } from '@/components/exploration/MobileHud';
import { DirectionPad } from '@/components/exploration/DirectionPad';
import { DialogueBox } from '@/components/DialogueBox';
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
import { useBattleOverlayStore } from '@/state/useBattleOverlayStore';
import {
  callOpenChest,
  callVisitLandmark,
  callCollectWorldItem,
  callInteractWithShrine,
  callTalkToNpc,
} from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { LOCATIONS, NPCS } from '@/data';
import { itemDisplayName } from '@/utils/itemName';
import { enemyMapIconScale } from '@/utils/enemyMapIcon';
import { isTypingTarget } from '@/utils/keyboard';
import { resolveNpcDialogue, hasNewDialogue } from '@/utils/npcDialogue';
import { playMusic, playSound } from '@/audio/audioService';
import type { Npc } from '@/types';
import styles from './TownScene.module.css';

/** Which Cloud Function a point `interactable` landmark's Interact-key press routes through - a
 *  single source of truth (rather than one Set per kind, which made it easy to add a refId to one
 *  and forget another) for a purely client-side dispatch decision, not an item-identity lookup;
 *  the granted item's id (for 'fragment') always comes back in that call's own response. Separate
 *  from ZONE_LANDMARK_KIND below since a walk-in `zone`'s refId and a point `interactable`'s refId
 *  are dispatched from two different code paths - Spirit Grove's shrine is a distinct point
 *  object placed inside its own walk-in `spirit-grove` zone (the clearing and its shrine share a
 *  refId but are two separate map objects/interactions), so it appears in both tables. */
const POINT_LANDMARK_KIND: Record<string, 'shrine' | 'fragment'> = {
  'spirit-grove': 'shrine',
  'fallen-watchtower': 'fragment',
  'water-fragment': 'fragment',
  'frostbound-treatise-cache': 'fragment',
  'ember-codex-tunnel': 'fragment',
};
/** Which Cloud Function a walk-in `zone` landmark fires the instant the player's tile enters it -
 *  no Interact needed. Hunter's Camp and Spirit Grove (the clearing, not its shrine) are pure
 *  discovery ('visitOnly'); Mossy Creek also grants a key item ('fragment'). */
const ZONE_LANDMARK_KIND: Record<string, 'visitOnly' | 'fragment'> = {
  'hunters-camp': 'visitOnly',
  'spirit-grove': 'visitOnly',
  'mossy-creek': 'fragment',
};

/** Display name for any interactable on this map, shared between the entity labels and the
 *  "nothing to do here yet" fallback message so they never drift out of sync. */
function labelForInteractable(refId: string, openedChests: string[]): string {
  if (refId.startsWith('chest-')) return openedChests.includes(refId) ? 'Empty Chest' : 'Chest';
  if (refId === 'water-fragment') return 'a faint glimmer in the pool';
  if (refId === 'frostbound-treatise-cache') return 'a hidden cache behind the falls';
  if (refId === 'ember-codex-tunnel') return 'an overlooked maintenance tunnel';
  const landmark = LOCATIONS.find((l) => l.id === refId);
  if (landmark) return landmark.name;
  return 'something';
}

export function OverworldScene() {
  const locationId = useSceneStore((s) => s.params.locationId) ?? 'ironwood-trail';
  const goTo = useSceneStore((s) => s.goTo);
  // One generic overworld theme for all regions this MVP pass (per-region variants are a
  // follow-up) - playMusic no-ops if it's already playing, so crossing between regions doesn't
  // restart the track.
  useEffect(() => {
    void playMusic('music.overworld');
  }, []);
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const questProgress = useQuestStore((s) => s.progress);
  const openedChests = useWorldStateStore((s) => s.openedChests);
  const seenNpcDialogueVariant = useWorldStateStore((s) => s.seenNpcDialogueVariant);
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const skin = usePlayerStore((s) => s.player?.skin ?? 'male');
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const battleOverlayOpen = useBattleOverlayStore((s) => s.isOpen);
  const hudBarHeight = useHudBarHeight();
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const otherOverlaysOpen = activeNpc !== null || menuOpen || journalOpen || message !== null;
  const { mapOpen, toggleMap, closeMap } = useMapOverlay(otherOverlaysOpen);
  const suspended = otherOverlaysOpen || mapOpen;
  const { pending, run } = usePendingAction();

  function handleZoneEnter(refId: string) {
    const kind = ZONE_LANDMARK_KIND[refId];
    if (kind === 'fragment') {
      run(() => callCollectWorldItem(locationId, refId), 'Collecting...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          const name = itemDisplayName(res.itemId);
          setMessage(
            res.alreadyCollected
              ? "There's nothing left to find here."
              : `You recover ${name}. It feels like part of something larger.`,
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'Nothing happens.'));
      return;
    }
    if (kind === 'visitOnly') {
      const landmarkName = LOCATIONS.find((l) => l.id === refId)?.name ?? refId;
      run(() => callVisitLandmark(refId), 'Investigating...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          setMessage(
            res.alreadyVisited
              ? `You've already explored ${landmarkName}.`
              : `You find ${landmarkName}. Perhaps it will mean something, in time.`,
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'You cannot linger here.'));
    }
  }

  const { map, position, positionRef, facingDelta, attemptMove, movementState, wanderPositions } = useLocationExploration({
    locationId,
    suspended,
    onFieldEncounterStep: (pos) => {
      const icon = consumeFieldEncounterAt(pos.x, pos.y);
      if (icon) goTo('combat', { locationId, spawnX: pos.x, spawnY: pos.y });
    },
    onBlockedTransition: setMessage,
    onZoneEnter: handleZoneEnter,
  });
  const { icons: fieldEncounterIcons, consumeAt: consumeFieldEncounterAt } = useFieldEncounters(map, locationId, positionRef);

  useHeartbeat(uid, displayName, locationId, position, skin);
  useDragMovement(gridWrapperRef, attemptMove, isMobile && !suspended);
  const { startDash, stopDash } = useExplorationDash(attemptMove, positionRef, staminaUnlocked && !suspended);

  function attemptInteract() {
    if (suspended || !map) return;
    const { dx, dy } = facingDelta(position.facing);
    const target = { x: position.x + dx, y: position.y + dy };

    const npcObject = map.objects.find((o) => {
      if (o.type !== 'npc' || !o.refId) return false;
      const pos = wanderPositions[o.refId] ?? { x: o.x, y: o.y };
      return pos.x === target.x && pos.y === target.y;
    });
    if (npcObject?.refId) {
      const npc = NPCS.find((n) => n.id === npcObject.refId);
      if (npc) {
        setActiveNpc(npc);
        void playSound('sfx.npc-talk');
        run(() => callTalkToNpc(npc.id), 'Talking...')
          ?.then(async () => {
            if (uid) await resyncSave(uid);
          })
          .catch((err) => console.error('talkToNpc failed', err));
      }
      return;
    }

    const obj = map.objects.find(
      (o) => o.type === 'interactable' && o.x === target.x && o.y === target.y,
    );
    if (obj?.refId?.startsWith('chest-')) {
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
      return;
    }
    if (obj?.refId && POINT_LANDMARK_KIND[obj.refId] === 'shrine') {
      const refId = obj.refId;
      const landmarkName = LOCATIONS.find((l) => l.id === refId)?.name ?? refId;
      run(() => callInteractWithShrine(locationId, refId), 'Interacting with shrine...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          void playSound('sfx.shrine');
          if (res.unlockedStamina) {
            setMessage(
              `The shrine at ${landmarkName} kindles fully alight once more. You feel the trail's strength answer you - Stamina is yours to command now.`,
            );
          } else {
            setMessage(`You have found ${landmarkName}. A shrine stands here, long neglected.`);
          }
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The shrine does not respond.'));
      return;
    }
    if (obj?.refId && POINT_LANDMARK_KIND[obj.refId] === 'fragment') {
      const refId = obj.refId;
      run(() => callCollectWorldItem(locationId, refId), 'Collecting...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          const name = itemDisplayName(res.itemId);
          setMessage(
            res.alreadyCollected
              ? "There's nothing left to find here."
              : `You recover ${name}. It feels like part of something larger.`,
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'Nothing happens.'));
      return;
    }
    if (obj?.refId) {
      const label = labelForInteractable(obj.refId, openedChests);
      setMessage(`You find ${label.startsWith('Empty') ? 'an ' + label.toLowerCase() : 'a ' + label.toLowerCase()}. Perhaps it will mean something, in time.`);
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (e.key === 'Escape') {
        if (activeNpc) setActiveNpc(null);
        else if (message) setMessage(null);
        else if (menuOpen) setMenuOpen(false);
        else if (journalOpen) setJournalOpen(false);
        return;
      }
      if (e.key === 'i' || e.key === 'I') setMenuOpen((open) => !open);
      if (e.key === 'j' || e.key === 'J') setJournalOpen((open) => !open);
      if (e.key === 'Enter' || e.key === ' ') attemptInteract();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNpc, message, menuOpen, journalOpen, map, position, facingDelta, uid, questProgress, wanderPositions]);

  // Memoized so a re-render caused by unrelated state (message/menuOpen/etc.) doesn't hand
  // TileGrid a brand-new array reference every time - PhaserExplorationCanvas re-runs
  // setEntities(entities) whenever this reference changes, which is wasted work when nothing
  // about the entities themselves actually changed. Must run unconditionally (before the `!map`
  // early return below) - hooks can never be skipped on some renders and not others.
  const entities = useMemo<GridEntity[]>(() => {
    if (!map) return [];
    const npcEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'npc' && o.refId)
      .map((o) => {
        const npc = NPCS.find((n) => n.id === o.refId);
        const pos = wanderPositions[o.refId!] ?? { x: o.x, y: o.y };
        return {
          id: o.refId!,
          x: pos.x,
          y: pos.y,
          spriteAssetId: npc?.spriteAssetId ?? 'sprite.player',
          label: npc?.name,
          badge: npc && hasNewDialogue(npc, questProgress, seenNpcDialogueVariant) ? '!' : undefined,
        };
      });

    const interactableEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'interactable' && o.refId)
      .map((o) => {
        const isChest = o.refId!.startsWith('chest-');
        return {
          id: o.refId!,
          x: o.x,
          y: o.y,
          spriteAssetId: isChest
            ? openedChests.includes(o.refId!)
              ? 'structure.chest-open'
              : 'structure.chest'
            : 'structure.shrine',
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

    // Every transition (region-to-region crossings) gets a visible marker instead of looking like
    // plain ground - the generic structure.door placeholder, same as TownScene's interior exits.
    const exitEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'transition' && o.refId)
      .map((o) => ({ id: `exit-${o.refId}`, x: o.x, y: o.y, spriteAssetId: 'structure.door', label: 'Exit' }));

    return [...npcEntities, ...interactableEntities, ...exitEntities, ...fieldEncounterEntities];
  }, [map, wanderPositions, questProgress, seenNpcDialogueVariant, openedChests, fieldEncounterIcons]);

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Setting out...</p>
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
          playerSpriteAssetId={skin === 'female' ? 'sprite.player.female' : 'sprite.player.male'}
          entities={entities}
          scale={scale}
          viewportSize={viewportSize}
          playerFrameRow={resolveDisplayRow(PLAYER_ANIMATION_LAYOUT, movementState, position.facing)}
          playerMovementState={movementState}
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
          &nbsp;·&nbsp; Avoid or approach enemies to fight &nbsp;·&nbsp; Inventory: I &nbsp;·&nbsp; Journal: J &nbsp;·&nbsp; Map: M
        </p>
      )}
      {activeNpc && (
        <DialogueBox
          lines={resolveNpcDialogue(activeNpc, questProgress)}
          portraitAssetId={activeNpc.portraitAssetId}
          onClose={() => setActiveNpc(null)}
        />
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
