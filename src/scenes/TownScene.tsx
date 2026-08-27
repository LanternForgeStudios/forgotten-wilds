import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '@/components/common/Panel';
import { TileGrid, type GridEntity, type TileGridHandle } from '@/components/exploration/TileGrid';
import { MessageOverlay } from '@/components/exploration/MessageOverlay';
import { MobileHud } from '@/components/exploration/MobileHud';
import { DirectionPad } from '@/components/exploration/DirectionPad';
import { DialogueBox } from '@/components/DialogueBox';
import { PlayerHUD } from '@/components/PlayerHUD';
import { CharacterMenu } from '@/components/CharacterMenu';
import { Shop } from '@/components/Shop';
import { ApothecaryRestockPanel } from '@/components/ApothecaryRestockPanel';
import { Inn } from '@/components/Inn';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { WorldChat } from '@/components/WorldChat';
import { MiniMap } from '@/components/MiniMap';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useMapOverlay } from '@/hooks/useMapOverlay';
import { useHeartbeat, POSITION_THROTTLE_MS } from '@/hooks/useHeartbeat';
import { usePendingAction } from '@/hooks/usePendingAction';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useExplorationViewport, useHudBarHeight } from '@/hooks/useExplorationViewport';
import { useDragMovement } from '@/hooks/useDragMovement';
import { useExplorationDash } from '@/hooks/useExplorationDash';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useQuestStore } from '@/state/useQuestStore';
import { useMapPreferencesStore } from '@/state/useMapPreferencesStore';
import { resolveActiveQuestTargetRefIds } from '@/utils/questTargetLookup';
import { useInventoryStore } from '@/state/useInventoryStore';
import { useJournalStore } from '@/state/useJournalStore';
import { useSceneStore } from '@/state/useSceneStore';
import { callTalkToNpc, callInteractWithShrine, callSendFriendRequest } from '@/firebase/functionsClient';
import { RewardPopup } from '@/components/RewardPopup';
import { LorePopup } from '@/components/LorePopup';
import { useLorePopupQueue } from '@/hooks/useLorePopupQueue';
import { useQuestRewardPopup } from '@/hooks/useQuestRewardPopup';
import { resyncSave } from '@/state/hydrate';
import { subscribeToPresence } from '@/firebase/presenceService';
import { NPCS, LOCATIONS, APOTHECARY_SHOP_IDS } from '@/data';
import { resolveDecorEntity } from '@/data/decorEntities';
import type { Npc, OnlinePresence, WeatherKind } from '@/types';
import { resolveWeather } from '@/utils/weather';
import { STORY_WEATHER_LOCKS } from '@/data/weatherConfig';
import { isOutdoorTopLevelLocation } from '@/utils/location';
import { useTimeOfDayStore } from '@/state/useTimeOfDayStore';
import { useDebugStore } from '@/state/useDebugStore';
import type { TimePhase } from '@/types';
import { isTypingTarget } from '@/utils/keyboard';
import { resolveEquipmentLayers, resolvePlayerBaseSpriteAssetId } from '@/utils/equipmentLayers';
import { resolveNpcDialogue, hasNewDialogue } from '@/utils/npcDialogue';
import { shrineSpriteAssetId } from '@/utils/shrineRestoration';
import { eligibleLanternUpgrades } from '@/utils/lanternOilUpgradeEligibility';
import { useWorldStateStore } from '@/state/useWorldStateStore';
import { useBattleOverlayStore } from '@/state/useBattleOverlayStore';
import { playMusic, playSound } from '@/audio/audioService';
import styles from './TownScene.module.css';
import menuStyles from '@/components/CharacterMenu.module.css';

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


export function TownScene() {
  const locationId = useSceneStore((s) => s.params.locationId) ?? 'ash-hallow';
  // One theme per town, shared with all its interiors (a building falls back to its parent town's
  // musicAssetId before the generic default, so an interior with no bespoke track of its own still
  // matches its town rather than reverting to a flat game-wide theme) - playMusic no-ops if it's
  // already playing, so moving between the town square and a building doesn't restart the track.
  useEffect(() => {
    const location = LOCATIONS.find((l) => l.id === locationId);
    const parentLocation = location?.parentLocationId ? LOCATIONS.find((l) => l.id === location.parentLocationId) : undefined;
    void playMusic(location?.musicAssetId ?? parentLocation?.musicAssetId ?? 'music.town');
  }, [locationId]);
  // Weather only ever renders for the outdoor town square itself - resolveWeather returns null
  // for any location with a parentLocationId set (every interior), so this naturally no-ops while
  // walking through a building without needing to special-case interiors here.
  const [weather, setWeather] = useState<WeatherKind | null>(null);
  useEffect(() => {
    setWeather(resolveWeather(locationId, useQuestStore.getState().progress));
  }, [locationId]);
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [activeShopId, setActiveShopId] = useState<string | undefined>();
  const [shopInitialTab, setShopInitialTab] = useState<'buy' | 'sell' | 'upgrade'>('buy');
  // Set to a shopId when that shop offers a Lantern Oil upgrade the player is eligible for, or is
  // an Apothecary/Herbalist - presents a "Buy/Sell vs Upgrade Lantern vs Restock Supplies" choice
  // (whichever options actually apply) before Shop/ApothecaryRestockPanel opens, instead of always
  // going straight to Buy/Sell. Every other shop skips this and behaves exactly as it did before
  // either feature existed (see handleDialogueClose below).
  const [shopActionChoice, setShopActionChoice] = useState<string | null>(null);
  // Set to an Apothecary/Herbalist shopId when the player picks "Restock Supplies" from the choice
  // above - opens ApothecaryRestockPanel instead of Shop.
  const [activeApothecaryShopId, setActiveApothecaryShopId] = useState<string | null>(null);
  const [innOpen, setInnOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [worldChatOpen, setWorldChatOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { currentLorePopup, queueLorePopups, dismissCurrentLorePopup } = useLorePopupQueue();
  // Shared reward-acknowledgment popup (see RewardPopup.tsx).
  const { rewardPopup, setRewardPopup, showQuestRewardPopup } = useQuestRewardPopup(queueLorePopups);
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const gender = usePlayerStore((s) => s.player?.gender ?? 'male');
  const appearance = usePlayerStore((s) => s.player?.appearance ?? 'white-dark');
  const equipment = usePlayerStore((s) => s.player?.equipment);
  const playerLevel = usePlayerStore((s) => s.player?.level ?? 1);
  const equipmentLayers = useMemo(() => resolveEquipmentLayers(equipment, gender), [equipment, gender]);
  const questProgress = useQuestStore((s) => s.progress);
  const hiddenQuestIds = useMapPreferencesStore((s) => s.hiddenQuestIds);
  // If this location's own weather-lock quest completes while the player is standing here (not
  // just on the next visit), clear the lock immediately - keyed on that one quest's status only,
  // not all of `questProgress`, so it doesn't re-roll on unrelated quest progress (see
  // OverworldScene.tsx's identical pair of effects).
  const lockQuestId = STORY_WEATHER_LOCKS[locationId]?.questId;
  const lockQuestStatus = lockQuestId ? questProgress[lockQuestId]?.status : undefined;
  useEffect(() => {
    setWeather(resolveWeather(locationId, useQuestStore.getState().progress));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockQuestStatus]);
  // Debug tab overrides (see OverworldScene.tsx's identical block) - both gated by the same
  // outdoor-eligibility check as normal resolution, so a building interior (which shares this
  // scene component with its outdoor town square) never shows a forced weather/lighting effect
  // even with an override set.
  const outdoorEligible = isOutdoorTopLevelLocation(locationId);
  const timeOfDayPhase = useTimeOfDayStore((s) => s.phase);
  const debugWeatherOverride = useDebugStore((s) => s.weatherOverride);
  const debugTimeOverride = useDebugStore((s) => s.timeOverride);
  const debugShowCollisions = useDebugStore((s) => s.showCollisions);
  const effectiveWeather = outdoorEligible ? (debugWeatherOverride ?? weather) : null;
  const effectiveTimePhase: TimePhase = outdoorEligible ? (debugTimeOverride ?? timeOfDayPhase) : 'day';
  const inventory = useInventoryStore((s) => s.items);
  const bossesDefeated = useJournalStore((s) => s.journal.bossesDefeated);
  const seenNpcDialogueVariant = useWorldStateStore((s) => s.seenNpcDialogueVariant);
  const openedChests = useWorldStateStore((s) => s.openedChests);
  const isMobile = useIsMobile();
  const battleOverlayOpen = useBattleOverlayStore((s) => s.isOpen);
  const hudBarHeight = useHudBarHeight();
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const otherOverlaysOpen =
    activeNpc !== null ||
    menuOpen ||
    shopOpen ||
    innOpen ||
    journalOpen ||
    worldChatOpen ||
    message !== null ||
    rewardPopup !== null ||
    currentLorePopup !== null ||
    shopActionChoice !== null ||
    activeApothecaryShopId !== null;
  const { mapOpen, toggleMap, closeMap } = useMapOverlay(otherOverlaysOpen);
  const suspended = otherOverlaysOpen || mapOpen;
  const { map, position, spawnPosition, reportPosition, movementInput, wanderPositions, handleTransitionEnter } = useLocationExploration({
    locationId,
    suspended,
    onBlockedTransition: setMessage,
  });
  const [presences, setPresences] = useState<OnlinePresence[]>([]);
  const { pending, run } = usePendingAction();
  const gridRef = useRef<TileGridHandle>(null);

  useHeartbeat(uid, displayName, locationId, position, gender, appearance, equipment);
  useDragMovement(gridWrapperRef, movementInput.setDirectionHeld, isMobile && !suspended);
  const { startDash, stopDash } = useExplorationDash(movementInput.setDashHeld, staminaUnlocked && !suspended);

  useEffect(() => subscribeToPresence(setPresences), []);

  function handleDialogueClose() {
    const hook = activeNpc?.gameplayHook;
    setActiveNpc(null);
    if (hook?.type === 'shop') {
      const hasLanternUpgrade = eligibleLanternUpgrades(hook.shopId, inventory, equipment, bossesDefeated).length > 0;
      if (hasLanternUpgrade || APOTHECARY_SHOP_IDS.includes(hook.shopId)) {
        setShopActionChoice(hook.shopId);
      } else {
        setActiveShopId(hook.shopId);
        setShopInitialTab('buy');
        setShopOpen(true);
      }
    } else if (hook?.type === 'inn') {
      setInnOpen(true);
    }
  }

  function chooseShopAction(tab: 'buy' | 'sell' | 'upgrade' | 'restock') {
    if (!shopActionChoice) return;
    if (tab === 'restock') {
      setActiveApothecaryShopId(shopActionChoice);
    } else {
      setActiveShopId(shopActionChoice);
      setShopInitialTab(tab);
      setShopOpen(true);
    }
    setShopActionChoice(null);
  }

  function attemptInteract() {
    if (suspended || !map) return;
    // Pixel-space directional probe (see ExplorationScene.ts's queryInteraction) - replaces the
    // old exact-facing-tile lookup. `result.id` is whatever the matched kind's own data is keyed
    // by: an npc/interactable's refId, or a presence entity's GridEntity id (`player-<uid>`, the
    // same id otherPlayerEntities below already renders it under).
    const result = gridRef.current?.queryInteraction();
    if (!result) return;

    if (result.kind === 'npc') {
      const npc = NPCS.find((n) => n.id === result.id);
      if (npc) {
        setActiveNpc(npc);
        void playSound('sfx.npc-talk');
        run(() => callTalkToNpc(npc.id), 'Talking...')
          ?.then(async (res) => {
            if (uid) await resyncSave(uid);
            showQuestRewardPopup(res.questRewards);
          })
          .catch((err) => console.error('talkToNpc failed', err));
      }
      return;
    }

    if (result.kind === 'presence') {
      const now = Date.now();
      const otherPlayer = presences.find(
        (p) =>
          `player-${p.uid}` === result.id &&
          p.uid !== uid &&
          p.locationId === locationId &&
          now - p.lastHeartbeat < PRESENCE_STALE_AFTER_MS,
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
      }
      return;
    }

    // result.kind === 'interactable'
    const refId = result.id;
    const decorEntity = resolveDecorEntity(refId);
    if (decorEntity) {
      setMessage(decorEntity.flavorText);
      return;
    }
    if (SHRINES.has(refId)) {
      run(() => callInteractWithShrine(locationId, refId), 'Interacting with shrine...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          void playSound('sfx.shrine');
          if (res.unlockedStamina) {
            setMessage('The shrine kindles fully alight once more. You feel the trail\'s strength answer you - Stamina is yours to command now.');
          } else if (res.questRewards) {
            showQuestRewardPopup(res.questRewards);
          } else {
            setMessage('A small stone shrine, half-forgotten. Something here still remembers being tended.');
          }
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The shrine does not respond.'));
    }
  }

  useEffect(() => {
    function handleInteract(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (e.key === 'Escape' && (shopActionChoice || rewardPopup || currentLorePopup || message)) {
        if (shopActionChoice) setShopActionChoice(null);
        else if (rewardPopup) setRewardPopup(null);
        else if (currentLorePopup) dismissCurrentLorePopup();
        else setMessage(null);
        return;
      }
      // Blocks *opening* a new overlay while one of these is already up (a stacked pair then
      // shares one Escape-close and closes together); doesn't block closing the same overlay
      // back off via its own key. Deliberately excludes menuOpen/journalOpen/worldChatOpen
      // themselves - those are the ones these three keys toggle.
      const blockingOverlayOpen =
        activeNpc !== null ||
        shopOpen ||
        innOpen ||
        message !== null ||
        rewardPopup !== null ||
        currentLorePopup !== null ||
        shopActionChoice !== null ||
        activeApothecaryShopId !== null;
      if (e.key === 'i' || e.key === 'I') {
        if (menuOpen || !blockingOverlayOpen) setMenuOpen((open) => !open);
        return;
      }
      if (e.key === 'j' || e.key === 'J') {
        if (journalOpen || !blockingOverlayOpen) setJournalOpen((open) => !open);
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        if (worldChatOpen || !blockingOverlayOpen) setWorldChatOpen((open) => !open);
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
    shopActionChoice,
    rewardPopup,
    currentLorePopup,
    message,
    menuOpen,
    shopOpen,
    innOpen,
    journalOpen,
    worldChatOpen,
    map,
    uid,
    // attemptInteract's 'presence' branch closes over this - without it, the listener kept using
    // whichever `presences` snapshot was current the last time one of the OTHER deps above
    // changed, not the latest one. A nearby player logging in/moving into range independently of
    // every other listed dep meant the friend-request interaction could silently no-op against a
    // stale (missing) entry.
    presences,
  ]);

  // Memoized so a re-render caused by unrelated state (message/menuOpen/etc.) doesn't hand
  // TileGrid a brand-new array reference every time - PhaserExplorationCanvas re-runs
  // setEntities(entities) whenever this reference changes, which is wasted work when nothing
  // about the entities themselves actually changed. Must run unconditionally (before the `!map`
  // early return below) - hooks can never be skipped on some renders and not others.
  const entities = useMemo<GridEntity[]>(() => {
    if (!map) return [];
    // Same target-resolution rules as MiniMap.tsx's own "quest gold ring" (see
    // questTargetLookup.ts) - lets a quest-target NPC/building/shrine/exit show the floating
    // marker ExplorationScene.ts renders above its head, not just on the map overlay.
    const activeQuestTargetRefIds = resolveActiveQuestTargetRefIds(map, questProgress, hiddenQuestIds);

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
          questTarget: activeQuestTargetRefIds.has(o.refId!),
          // Only meaningful for a wandering NPC whose sheet actually has walk rows
          // (NPC_WALK_ASSET_IDS) - upsertEntity/animationLayoutForSprite fall back to idle/static
          // for everyone else regardless of what's passed here.
          movementState: pos.isMoving ? 'walking' : undefined,
          facing: pos.facing,
          blocksMovement: true,
          interactionKind: 'npc',
        };
      });

    const buildingEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'transition' && o.refId && BUILDING_MARKERS[o.refId])
      .map((o) => {
        const marker = BUILDING_MARKERS[o.refId!];
        return {
          id: `building-${o.refId}`,
          x: o.x,
          y: o.y,
          spriteAssetId: marker.spriteAssetId,
          label: marker.label,
          questTarget: activeQuestTargetRefIds.has(o.refId!),
        };
      });

    const shrineEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'interactable' && o.refId && SHRINES.has(o.refId))
      .map((o) => ({
        id: o.refId!,
        x: o.x,
        y: o.y,
        spriteAssetId: shrineSpriteAssetId(o.refId!, questProgress),
        label: 'Shrine',
        questTarget: activeQuestTargetRefIds.has(o.refId!),
        blocksMovement: true,
      }));

    // Every transition that doesn't already get a building facade (buildingEntities above) -
    // mainly each interior's own door back outside - gets the generic pulsing exit marker instead
    // of looking like plain floor.
    const exitEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'transition' && o.refId && !BUILDING_MARKERS[o.refId])
      .map((o) => ({
        id: `exit-${o.refId}`,
        x: o.x,
        y: o.y,
        spriteAssetId: 'structure.exit-marker',
        label: 'Exit',
        questTarget: activeQuestTargetRefIds.has(o.refId!),
      }));

    const decorEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'interactable' && o.refId && resolveDecorEntity(o.refId))
      .map((o) => {
        const decor = resolveDecorEntity(o.refId!)!;
        // No floating name tag for purely ambient decor (fireplace, mushrooms, every general-*
        // station prop) - only quest-relevant interactables and shrines keep one (reported live:
        // these were cluttering the map with tooltips for props that don't do anything on
        // interact besides flavor text). The flavor-text-only interact path itself still uses
        // decor.label for its message - only this floating tag is suppressed.
        return { id: o.refId!, x: o.x, y: o.y, spriteAssetId: decor.spriteAssetId, label: undefined, blocksMovement: true };
      });

    const now = Date.now();
    const otherPlayerEntities: GridEntity[] = presences
      .filter(
        (p) =>
          p.uid !== uid && p.locationId === locationId && now - p.lastHeartbeat < PRESENCE_STALE_AFTER_MS,
      )
      .map((p) => {
        const presenceGender = p.gender ?? 'male';
        return {
          id: `player-${p.uid}`,
          x: p.x,
          y: p.y,
          // Same base-body + equipment-layer resolution as the local player's own rendering
          // (equipmentLayers/playerSpriteAssetId below) - so another online player looks the same
          // to everyone else as they do to themselves, instead of the old generic sprite.player.
          // male/female placeholder. Falls back the same way updatePresence.ts's own write-side
          // defaults do, for a presence doc written before appearance/equipment existed.
          spriteAssetId: resolvePlayerBaseSpriteAssetId(presenceGender, p.appearance ?? 'white-dark'),
          equipmentLayers: resolveEquipmentLayers(p.equipment, presenceGender),
          label: p.displayName,
          facing: p.facing ?? 'down',
          // Glides continuously across the full gap between this player's own throttled position
          // broadcasts (see useHeartbeat.ts) instead of ExplorationScene's default short glide,
          // which would otherwise dash to each new spot and then freeze until the next update -
          // reported live as remote players appearing to "jump" between positions.
          glideMs: POSITION_THROTTLE_MS,
          interactionKind: 'presence' as const,
        };
      });

    return [...npcEntities, ...buildingEntities, ...shrineEntities, ...decorEntities, ...exitEntities, ...otherPlayerEntities];
  }, [map, wanderPositions, questProgress, hiddenQuestIds, seenNpcDialogueVariant, presences, uid, locationId]);

  if (!map) {
    const arrivingTownName = LOCATIONS.find((l) => l.id === locationId)?.name;
    return (
      <div className={styles.wrap}>
        <p>{arrivingTownName ? `Arriving in ${arrivingTownName}...` : 'Arriving...'}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap} style={{ paddingTop: hudBarHeight }}>
      <PlayerHUD locationId={locationId} />
      {pending && <div className={styles.pendingIndicator}>{pending}</div>}
      <div ref={gridWrapperRef} style={{ touchAction: 'none' }}>
        <TileGrid
          ref={gridRef}
          map={map}
          player={spawnPosition}
          playerSpriteAssetId={resolvePlayerBaseSpriteAssetId(gender, appearance)}
          movementInputRef={movementInput.inputRef}
          suspended={suspended}
          onPositionChange={reportPosition}
          onTransitionEnter={handleTransitionEnter}
          entities={entities}
          scale={scale}
          viewportSize={viewportSize}
          equipmentLayers={equipmentLayers}
          weather={effectiveWeather}
          timePhase={effectiveTimePhase}
          showCollisions={debugShowCollisions}
        />
      </div>
      {/* Hidden entirely while a battle panel is open (mobile controls included) - see
          useBattleOverlayStore's own doc comment; the near-full-screen battle panel leaves no room
          for these and mobile's touch controls would otherwise sit uselessly (and confusingly)
          underneath it. */}
      {battleOverlayOpen ? null : isMobile ? (
        <>
          <DirectionPad setDirectionHeld={movementInput.setDirectionHeld} />
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
      {rewardPopup && (
        <RewardPopup title={rewardPopup.title} subtitle={rewardPopup.subtitle} lines={rewardPopup.lines} onClose={() => setRewardPopup(null)} />
      )}
      {!rewardPopup && currentLorePopup && (
        <LorePopup title={currentLorePopup.title} body={currentLorePopup.body} onClose={dismissCurrentLorePopup} />
      )}
      {menuOpen && <CharacterMenu onClose={() => setMenuOpen(false)} />}
      {shopOpen && <Shop shopId={activeShopId ?? ''} initialTab={shopInitialTab} onClose={() => setShopOpen(false)} />}
      {shopActionChoice && (
        <div className={menuStyles.overlay} onClick={() => setShopActionChoice(null)}>
          <Panel style={{ width: 'min(320px, 90vw)', textAlign: 'center' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', color: 'var(--fw-accent)' }}>What would you like to do?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className={menuStyles.smallButton} onClick={() => chooseShopAction('buy')}>
                Buy/Sell
              </button>
              {eligibleLanternUpgrades(shopActionChoice, inventory, equipment, bossesDefeated).length > 0 && (
                <button className={menuStyles.smallButton} onClick={() => chooseShopAction('upgrade')}>
                  Upgrade Lantern
                </button>
              )}
              {/* Gated at level 2 (i.e. "won at least one fight") - previously ungated, so a
                  brand-new level-1 character saw this the moment they first walked into any
                  Apothecary, before doing anything else. Mirrors requestApothecaryQuest.ts's own
                  server-side check below - this is just the earlier, friendlier warning. */}
              {APOTHECARY_SHOP_IDS.includes(shopActionChoice) && playerLevel >= 2 && (
                <button className={menuStyles.smallButton} onClick={() => chooseShopAction('restock')}>
                  Restock Supplies
                </button>
              )}
            </div>
          </Panel>
        </div>
      )}
      {activeApothecaryShopId && (
        <ApothecaryRestockPanel shopId={activeApothecaryShopId} onClose={() => setActiveApothecaryShopId(null)} />
      )}
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
