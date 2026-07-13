import { useEffect, useRef, useState } from 'react';
import { PlayerHUD } from '@/components/PlayerHUD';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { MobileHud } from '@/components/exploration/MobileHud';
import { DirectionPad } from '@/components/exploration/DirectionPad';
import { DialogueBox } from '@/components/DialogueBox';
import { Panel } from '@/components/common/Panel';
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
import { useDash } from '@/hooks/useDash';
import { useDashKeybind } from '@/hooks/useDashKeybind';
import { useSceneStore } from '@/state/useSceneStore';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useQuestStore } from '@/state/useQuestStore';
import { useWorldStateStore } from '@/state/useWorldStateStore';
import {
  callOpenChest,
  callVisitLandmark,
  callCollectWorldItem,
  callInteractWithShrine,
  callTalkToNpc,
} from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { ITEMS, EQUIPMENT, LOCATIONS, NPCS } from '@/data';
import { isTypingTarget } from '@/utils/keyboard';
import { resolveNpcDialogue, hasNewDialogue } from '@/utils/npcDialogue';
import type { Npc } from '@/types';
import styles from './TownScene.module.css';

/** Landmarks are pure "visit and see" sub-areas within a larger overworld map - visiting records
 *  Journal coverage and quest progress but doesn't grant an item. */
const VISIT_ONLY_LANDMARKS = new Set(['hunters-camp']);
/** Shrine-style landmarks route through interactWithShrine instead - see KNOWN_SHRINES in
 *  interactWithShrine.ts. That function fires both an interactWithShrine event (for
 *  investigate/restore quests) and a reachLocation event (for discovery quests) on every call, so
 *  the same tile naturally supports "first find it" and "later restore it" as separate quests. */
const SHRINE_LANDMARKS = new Set(['spirit-grove']);
/** Landmarks that grant a key item the first time they're visited, routed through
 *  callCollectWorldItem - purely a client-side dispatch decision (which call to make), not an
 *  item-identity lookup; the granted item's id comes back in that call's own response. */
const FRAGMENT_LANDMARKS = new Set(['mossy-creek', 'fallen-watchtower', 'water-fragment']);

/** Display name for any interactable on this map, shared between the entity labels and the
 *  "nothing to do here yet" fallback message so they never drift out of sync. */
function labelForInteractable(refId: string, openedChests: string[]): string {
  if (refId.startsWith('chest-')) return openedChests.includes(refId) ? 'Empty Chest' : 'Chest';
  if (refId === 'water-fragment') return 'a faint glimmer in the pool';
  const landmark = LOCATIONS.find((l) => l.id === refId);
  if (landmark) return landmark.name;
  return 'something';
}

export function OverworldScene() {
  const locationId = useSceneStore((s) => s.params.locationId) ?? 'ironwood-trail';
  const goTo = useSceneStore((s) => s.goTo);
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
  const hudBarHeight = useHudBarHeight();
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const otherOverlaysOpen = activeNpc !== null || menuOpen || journalOpen || message !== null;
  const { mapOpen, toggleMap, closeMap } = useMapOverlay(otherOverlaysOpen);
  const suspended = otherOverlaysOpen || mapOpen;
  const { map, position, positionRef, facingDelta, attemptMove, movementState, wanderPositions } = useLocationExploration({
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

  useHeartbeat(uid, displayName, locationId, position, skin);
  useDragMovement(gridWrapperRef, attemptMove, isMobile && !suspended);
  const [dashRampKey, setDashRampKey] = useState(0);
  const { startDash, stopDash } = useDash({
    attemptMove,
    positionRef,
    onRampUp: () => setDashRampKey((k) => k + 1),
  });
  useDashKeybind(startDash, stopDash, staminaUnlocked && !suspended);

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
          const name =
            EQUIPMENT.find((e) => e.id === res.itemId)?.name ??
            ITEMS.find((i) => i.id === res.itemId)?.name ??
            res.itemId;
          setMessage(
            res.alreadyOpened
              ? 'You already emptied this chest.'
              : `You open the chest and find ${name}!`,
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The chest will not open.'));
      return;
    }
    if (obj?.refId && SHRINE_LANDMARKS.has(obj.refId)) {
      const refId = obj.refId;
      const landmarkName = LOCATIONS.find((l) => l.id === refId)?.name ?? refId;
      run(() => callInteractWithShrine(locationId, refId), 'Interacting with shrine...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
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
    if (obj?.refId && VISIT_ONLY_LANDMARKS.has(obj.refId)) {
      const landmarkId = obj.refId;
      const landmarkName = LOCATIONS.find((l) => l.id === landmarkId)?.name ?? landmarkId;
      run(() => callVisitLandmark(landmarkId), 'Investigating...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          setMessage(
            res.alreadyVisited
              ? `You've already explored ${landmarkName}.`
              : `You find ${landmarkName}. Perhaps it will mean something, in time.`,
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'You cannot linger here.'));
      return;
    }
    if (obj?.refId && FRAGMENT_LANDMARKS.has(obj.refId)) {
      const refId = obj.refId;
      run(() => callCollectWorldItem(locationId, refId), 'Collecting...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          const name = ITEMS.find((i) => i.id === res.itemId)?.name ?? res.itemId;
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

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Setting out...</p>
      </div>
    );
  }

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
    .map((o) => ({
      id: o.refId!,
      x: o.x,
      y: o.y,
      spriteAssetId: o.refId!.startsWith('chest-') ? 'structure.chest' : 'structure.shrine',
      label: labelForInteractable(o.refId!, openedChests),
    }));

  const fieldEncounterEntities: GridEntity[] = fieldEncounterIcons.map((icon) => ({
    id: icon.id,
    x: icon.x,
    y: icon.y,
    spriteAssetId: icon.spriteAssetId,
  }));

  const entities = [...npcEntities, ...interactableEntities, ...fieldEncounterEntities];

  return (
    <div className={styles.wrap} style={{ paddingTop: hudBarHeight }}>
      <PlayerHUD locationId={locationId} />
      {pending && <div className={styles.pendingIndicator}>{pending}</div>}
      <div ref={gridWrapperRef} style={{ touchAction: 'none' }}>
        <TileGrid
          map={map}
          tilesetAssetId="tileset.tiny-dungeon"
          tilesetColumns={map.columns}
          player={position}
          playerSpriteAssetId={skin === 'female' ? 'sprite.player.female' : 'sprite.player.male'}
          entities={entities}
          scale={scale}
          viewportSize={viewportSize}
          playerFrameRow={resolveDisplayRow(PLAYER_ANIMATION_LAYOUT, movementState, position.facing)}
          playerMovementState={movementState}
          dashRampTrigger={dashRampKey}
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
      {message && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 24,
            zIndex: 20,
          }}
          onClick={() => setMessage(null)}
        >
          <Panel style={{ width: 'min(600px, 90vw)' }}>
            <p style={{ margin: 0 }}>{message}</p>
            <p style={{ fontSize: 12, opacity: 0.7, textAlign: 'right', margin: '8px 0 0' }}>
              Click or Esc to close
            </p>
          </Panel>
        </div>
      )}
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
