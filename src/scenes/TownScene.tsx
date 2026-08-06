import { useEffect, useMemo, useRef, useState } from 'react';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { MessageOverlay } from '@/components/exploration/MessageOverlay';
import { MobileHud } from '@/components/exploration/MobileHud';
import { DirectionPad } from '@/components/exploration/DirectionPad';
import { DialogueBox } from '@/components/DialogueBox';
import { PlayerHUD } from '@/components/PlayerHUD';
import { CharacterMenu } from '@/components/CharacterMenu';
import { Shop } from '@/components/Shop';
import { Inn } from '@/components/Inn';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { WorldChat } from '@/components/WorldChat';
import { MiniMap } from '@/components/MiniMap';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useMapOverlay } from '@/hooks/useMapOverlay';
import { PLAYER_ANIMATION_LAYOUT, resolveDisplayRow } from '@/animation/characterAnimations';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { usePendingAction } from '@/hooks/usePendingAction';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useExplorationViewport, useHudBarHeight } from '@/hooks/useExplorationViewport';
import { useDragMovement } from '@/hooks/useDragMovement';
import { useExplorationDash } from '@/hooks/useExplorationDash';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useQuestStore } from '@/state/useQuestStore';
import { useSceneStore } from '@/state/useSceneStore';
import { callTalkToNpc, callInteractWithShrine, callSendFriendRequest } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { subscribeToPresence } from '@/firebase/presenceService';
import { NPCS } from '@/data';
import type { Npc, OnlinePresence } from '@/types';
import { isTypingTarget } from '@/utils/keyboard';
import { resolveEquipmentLayers, resolvePlayerBaseSpriteAssetId } from '@/utils/equipmentLayers';
import { resolveNpcDialogue, hasNewDialogue } from '@/utils/npcDialogue';
import { shrineSpriteAssetId } from '@/utils/shrineRestoration';
import { useWorldStateStore } from '@/state/useWorldStateStore';
import { useBattleOverlayStore } from '@/state/useBattleOverlayStore';
import { playMusic, playSound } from '@/audio/audioService';
import styles from './TownScene.module.css';

const PRESENCE_STALE_AFTER_MS = 60_000;


/** Building-door transitions get a facade marker so they read as "a building" rather than a
 *  blank floor tile - keyed by the transition's target locationId (only entrances need this,
 *  not the exit transition back out, which every interior already has). */
const BUILDING_MARKERS: Record<string, { label: string; spriteAssetId: string }> = {
  'ash-hallow-elias-house': { label: 'Lantern Keeper Hall', spriteAssetId: 'structure.house' },
  'ash-hallow-mara-shop': { label: "Mara's Shop", spriteAssetId: 'structure.shop' },
  'ash-hallow-inn': { label: 'The Inn', spriteAssetId: 'structure.inn' },
  'ash-hallow-blacksmith': { label: 'The Forge', spriteAssetId: 'structure.blacksmith' },
  'ash-hallow-apothecary': { label: 'Apothecary', spriteAssetId: 'structure.apothecary' },
  'ash-hallow-armory': { label: 'The Armory', spriteAssetId: 'structure.armory' },
  'ash-hallow-archive': { label: 'The Archive', spriteAssetId: 'structure.archive' },
  'ash-hallow-mine-office': { label: 'Mine Office', spriteAssetId: 'structure.mine-office' },
  'ash-hallow-town-hall': { label: 'Town Hall', spriteAssetId: 'structure.town-hall' },
  // Crimson Bayou (MSQ Volume II) - every entrance rendered as the generic exit marker until this
  // pass added placeholder facade art (see structure.mirehaven-town-hall's registry note).
  'mirehaven-town-hall': { label: 'Town Hall', spriteAssetId: 'structure.mirehaven-town-hall' },
  'mirehaven-archive': { label: 'The Archive', spriteAssetId: 'structure.mirehaven-archive' },
  'mirehaven-inn': { label: 'The Inn', spriteAssetId: 'structure.mirehaven-inn' },
  'mirehaven-general-store': { label: 'General Store', spriteAssetId: 'structure.mirehaven-general-store' },
  'mirehaven-blacksmith': { label: "Toussaint's Forge", spriteAssetId: 'structure.mirehaven-blacksmith' },
  'mirehaven-armory': { label: "Delphine's Armory", spriteAssetId: 'structure.mirehaven-armory' },
  'mirehaven-herbalist': { label: 'Herbalist', spriteAssetId: 'structure.mirehaven-herbalist' },
  // Endless Prairie (MSQ Volume III) - every entrance rendered as the generic exit marker until
  // this pass added placeholder facade art (SVG, not PixelLab-generated - see
  // structure.highwind-crossing-chiefs-lodge's registry note for why).
  'highwind-crossing-chiefs-lodge': { label: "Chief's Lodge", spriteAssetId: 'structure.highwind-crossing-chiefs-lodge' },
  'highwind-crossing-spirit-lodge': { label: 'Spirit Lodge', spriteAssetId: 'structure.highwind-crossing-spirit-lodge' },
  'highwind-crossing-inn': { label: 'The Inn', spriteAssetId: 'structure.highwind-crossing-inn' },
  'highwind-crossing-general-store': { label: 'General Store', spriteAssetId: 'structure.highwind-crossing-general-store' },
  'highwind-crossing-blacksmith': { label: 'The Forge', spriteAssetId: 'structure.highwind-crossing-blacksmith' },
  'highwind-crossing-armory': { label: 'The Armory', spriteAssetId: 'structure.highwind-crossing-armory' },
  // Whispering Pines (MSQ Volume IV) - same placeholder-facade treatment.
  'cedarwatch-elders-lodge': { label: "Elder's Lodge", spriteAssetId: 'structure.cedarwatch-elders-lodge' },
  'cedarwatch-great-tree-library': { label: 'Great Tree Library', spriteAssetId: 'structure.cedarwatch-great-tree-library' },
  'cedarwatch-inn': { label: 'The Inn', spriteAssetId: 'structure.cedarwatch-inn' },
  'cedarwatch-general-store': { label: 'General Store', spriteAssetId: 'structure.cedarwatch-general-store' },
  'cedarwatch-blacksmith': { label: 'The Forge', spriteAssetId: 'structure.cedarwatch-blacksmith' },
  'cedarwatch-armory': { label: 'The Armory', spriteAssetId: 'structure.cedarwatch-armory' },
  // Shattered Desert (MSQ Volume V) - added at the same time the town itself was built, same
  // discipline as Whispering Pines above (a gap that took a user bug report to find for Prairie).
  'red-mesa-elders-hall': { label: "The Elder's Hall", spriteAssetId: 'structure.red-mesa-elders-hall' },
  'red-mesa-relic-museum': { label: 'The Relic Museum', spriteAssetId: 'structure.red-mesa-relic-museum' },
  'red-mesa-inn': { label: 'The Inn', spriteAssetId: 'structure.red-mesa-inn' },
  'red-mesa-general-store': { label: 'General Store', spriteAssetId: 'structure.red-mesa-general-store' },
  'red-mesa-blacksmith': { label: 'The Forge', spriteAssetId: 'structure.red-mesa-blacksmith' },
  'red-mesa-armory': { label: 'The Armory', spriteAssetId: 'structure.red-mesa-armory' },
  // Frozen Frontier (MSQ Volume VI) - added at the same time the town itself was built, closing
  // the BUILDING_MARKERS-gap pattern before it could recur a 4th time (see feedback_region_build_
  // workflow memory's grep-based allowlist check).
  'frosthaven-explorer-headquarters': { label: 'Explorer Headquarters', spriteAssetId: 'structure.frosthaven-explorer-headquarters' },
  'frosthaven-ice-chapel': { label: 'The Ice Chapel', spriteAssetId: 'structure.frosthaven-ice-chapel' },
  'frosthaven-inn': { label: 'The Inn', spriteAssetId: 'structure.frosthaven-inn' },
  'frosthaven-general-store': { label: 'General Store', spriteAssetId: 'structure.frosthaven-general-store' },
  'frosthaven-blacksmith': { label: 'The Forge', spriteAssetId: 'structure.frosthaven-blacksmith' },
  'frosthaven-armory': { label: 'The Armory', spriteAssetId: 'structure.frosthaven-armory' },
};

/** Shrine interactables on the open town map (currently just Ash Hallow's Town Shrine) - handled
 *  the same way OverworldScene routes shrine landmarks through interactWithShrine. */
const SHRINES = new Set(['ash-hallow-shrine']);

/** Purely decorative, non-gated interactables (no Cloud Function call - just a flavor message),
 *  keyed by refId. Animated via structure.decor-fireplace's own frameSize idle loop, same generic
 *  mechanism as structure.chest/structure.shrine-activated - no new animation code needed here. */
const DECOR_ENTITIES: Record<string, { label: string; spriteAssetId: string; flavorText: string }> = {
  fireplace: {
    label: 'Fireplace',
    spriteAssetId: 'structure.decor-fireplace',
    flavorText: 'The fire crackles warmly, filling the room with a gentle heat.',
  },
};

export function TownScene() {
  const locationId = useSceneStore((s) => s.params.locationId) ?? 'ash-hallow';
  // One theme for Ash Hallow and all its interiors - playMusic no-ops if it's already playing, so
  // moving between the town square and a building doesn't restart the track.
  useEffect(() => {
    void playMusic('music.town');
  }, []);
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [activeShopId, setActiveShopId] = useState<string | undefined>();
  const [innOpen, setInnOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [worldChatOpen, setWorldChatOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const gender = usePlayerStore((s) => s.player?.gender ?? 'male');
  const appearance = usePlayerStore((s) => s.player?.appearance ?? 'white-dark');
  const equipment = usePlayerStore((s) => s.player?.equipment);
  const equipmentLayers = useMemo(() => resolveEquipmentLayers(equipment, gender), [equipment, gender]);
  const questProgress = useQuestStore((s) => s.progress);
  const seenNpcDialogueVariant = useWorldStateStore((s) => s.seenNpcDialogueVariant);
  const openedChests = useWorldStateStore((s) => s.openedChests);
  const isMobile = useIsMobile();
  const battleOverlayOpen = useBattleOverlayStore((s) => s.isOpen);
  const hudBarHeight = useHudBarHeight();
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const otherOverlaysOpen =
    activeNpc !== null || menuOpen || shopOpen || innOpen || journalOpen || worldChatOpen || message !== null;
  const { mapOpen, toggleMap, closeMap } = useMapOverlay(otherOverlaysOpen);
  const suspended = otherOverlaysOpen || mapOpen;
  const { map, position, positionRef, facingDelta, attemptMove, movementState, wanderPositions } = useLocationExploration({
    locationId,
    suspended,
    onBlockedTransition: setMessage,
  });
  const [presences, setPresences] = useState<OnlinePresence[]>([]);
  const { pending, run } = usePendingAction();

  useHeartbeat(uid, displayName, locationId, position, gender);
  useDragMovement(gridWrapperRef, attemptMove, isMobile && !suspended);
  const { startDash, stopDash } = useExplorationDash(attemptMove, positionRef, staminaUnlocked && !suspended);

  useEffect(() => subscribeToPresence(setPresences), []);

  function handleDialogueClose() {
    const hook = activeNpc?.gameplayHook;
    setActiveNpc(null);
    if (hook?.type === 'shop') {
      setActiveShopId(hook.shopId);
      setShopOpen(true);
    } else if (hook?.type === 'inn') {
      setInnOpen(true);
    }
  }

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
    // Other players aren't map objects (they're live presence docs, positioned by their own
    // x/y - see otherPlayerEntities above), so this is a separate check rather than folding into
    // the npcObject search above.
    const now = Date.now();
    const otherPlayer = presences.find(
      (p) =>
        p.uid !== uid &&
        p.locationId === locationId &&
        now - p.lastHeartbeat < PRESENCE_STALE_AFTER_MS &&
        p.x === target.x &&
        p.y === target.y,
    );
    if (otherPlayer) {
      const name = otherPlayer.displayName;
      run(() => callSendFriendRequest(otherPlayer.uid), 'Sending friend request...')
        ?.then((res) => {
          setMessage(
            res.status === 'sent'
              ? `Friend request sent to ${name}.`
              : res.status === 'accepted'
                ? `You and ${name} are now friends!`
                : `You already have a pending request with ${name}.`,
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : `Could not reach ${name}.`));
      return;
    }
    const decorObject = map.objects.find(
      (o) => o.type === 'interactable' && o.refId && DECOR_ENTITIES[o.refId] && o.x === target.x && o.y === target.y,
    );
    if (decorObject?.refId) {
      setMessage(DECOR_ENTITIES[decorObject.refId].flavorText);
      return;
    }
    const shrineObject = map.objects.find(
      (o) => o.type === 'interactable' && o.refId && SHRINES.has(o.refId) && o.x === target.x && o.y === target.y,
    );
    if (shrineObject?.refId) {
      const refId = shrineObject.refId;
      run(() => callInteractWithShrine(locationId, refId), 'Interacting with shrine...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          void playSound('sfx.shrine');
          setMessage(
            res.unlockedStamina
              ? 'The shrine kindles fully alight once more. You feel the trail\'s strength answer you - Stamina is yours to command now.'
              : 'A small stone shrine, half-forgotten. Something here still remembers being tended.',
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The shrine does not respond.'));
    }
  }

  useEffect(() => {
    function handleInteract(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (e.key === 'Escape' && message) {
        setMessage(null);
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
      if (e.key === 'c' || e.key === 'C') {
        setWorldChatOpen((open) => !open);
        return;
      }
      // 'm'/'M' is handled by useMapOverlay itself (it owns its own keydown listener) - not
      // duplicated here.
      if (e.key !== 'Enter' && e.key !== ' ') return;
      attemptInteract();
    }
    window.addEventListener('keydown', handleInteract);
    return () => window.removeEventListener('keydown', handleInteract);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeNpc,
    message,
    menuOpen,
    shopOpen,
    innOpen,
    journalOpen,
    worldChatOpen,
    map,
    position,
    facingDelta,
    uid,
    wanderPositions,
  ]);

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
          // Only meaningful for a wandering NPC whose sheet actually has walk rows
          // (NPC_WALK_ASSET_IDS) - upsertEntity/animationLayoutForSprite fall back to idle/static
          // for everyone else regardless of what's passed here.
          movementState: pos.isMoving ? 'walking' : undefined,
          facing: pos.facing,
        };
      });

    const buildingEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'transition' && o.refId && BUILDING_MARKERS[o.refId])
      .map((o) => {
        const marker = BUILDING_MARKERS[o.refId!];
        return { id: `building-${o.refId}`, x: o.x, y: o.y, spriteAssetId: marker.spriteAssetId, label: marker.label };
      });

    const shrineEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'interactable' && o.refId && SHRINES.has(o.refId))
      .map((o) => ({
        id: o.refId!,
        x: o.x,
        y: o.y,
        spriteAssetId: shrineSpriteAssetId(o.refId!, questProgress),
        label: 'Shrine',
      }));

    // Every transition that doesn't already get a building facade (buildingEntities above) -
    // mainly each interior's own door back outside - gets the generic pulsing exit marker instead
    // of looking like plain floor.
    const exitEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'transition' && o.refId && !BUILDING_MARKERS[o.refId])
      .map((o) => ({ id: `exit-${o.refId}`, x: o.x, y: o.y, spriteAssetId: 'structure.exit-marker', label: 'Exit' }));

    const decorEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'interactable' && o.refId && DECOR_ENTITIES[o.refId])
      .map((o) => {
        const decor = DECOR_ENTITIES[o.refId!];
        return { id: o.refId!, x: o.x, y: o.y, spriteAssetId: decor.spriteAssetId, label: decor.label };
      });

    const now = Date.now();
    const otherPlayerEntities: GridEntity[] = presences
      .filter(
        (p) =>
          p.uid !== uid && p.locationId === locationId && now - p.lastHeartbeat < PRESENCE_STALE_AFTER_MS,
      )
      .map((p) => ({
        id: `player-${p.uid}`,
        x: p.x,
        y: p.y,
        spriteAssetId: p.gender === 'female' ? 'sprite.player.female' : 'sprite.player.male',
        label: p.displayName,
      }));

    return [...npcEntities, ...buildingEntities, ...shrineEntities, ...decorEntities, ...exitEntities, ...otherPlayerEntities];
  }, [map, wanderPositions, questProgress, seenNpcDialogueVariant, presences, uid, locationId]);

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Arriving in Ash Hallow...</p>
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
            onChat={() => setWorldChatOpen((open) => !open)}
            onMap={toggleMap}
          />
        </>
      ) : (
        <p className={styles.hint}>
          Move: arrow keys / WASD &nbsp;·&nbsp; Talk: Enter / Space
          {staminaUnlocked && <>&nbsp;·&nbsp; Dash: hold Shift</>}
          &nbsp;·&nbsp; Inventory: I &nbsp;·&nbsp; Journal: J &nbsp;·&nbsp; Chat: C &nbsp;·&nbsp; Map: M
        </p>
      )}
      {activeNpc && (
        <DialogueBox
          lines={resolveNpcDialogue(activeNpc, questProgress)}
          portraitAssetId={activeNpc.portraitAssetId}
          onClose={handleDialogueClose}
        />
      )}
      <MessageOverlay message={message} onClose={() => setMessage(null)} />
      {menuOpen && <CharacterMenu onClose={() => setMenuOpen(false)} />}
      {shopOpen && <Shop shopId={activeShopId ?? ''} onClose={() => setShopOpen(false)} />}
      {innOpen && <Inn onClose={() => setInnOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
      {worldChatOpen && <WorldChat onClose={() => setWorldChatOpen(false)} />}
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
