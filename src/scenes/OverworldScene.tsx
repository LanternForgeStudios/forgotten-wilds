import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerHUD } from '@/components/PlayerHUD';
import { TileGrid, type GridEntity, type TileGridHandle } from '@/components/exploration/TileGrid';
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
import { useMapPreferencesStore } from '@/state/useMapPreferencesStore';
import { resolveActiveQuestTargetRefIds } from '@/utils/questTargetLookup';
import { useWorldStateStore } from '@/state/useWorldStateStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { useJournalStore } from '@/state/useJournalStore';
import { useBattleOverlayStore } from '@/state/useBattleOverlayStore';
import {
  callOpenChest,
  callVisitLandmark,
  callCollectWorldItem,
  callInteractWithShrine,
  callTalkToNpc,
} from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { grantedItemIdFor } from '@/utils/worldItems';
import { LOCATIONS, NPCS } from '@/data';
import { resolveDecorEntity } from '@/data/decorEntities';
import { RewardPopup } from '@/components/RewardPopup';
import { LorePopup } from '@/components/LorePopup';
import { useLorePopupQueue } from '@/hooks/useLorePopupQueue';
import { useQuestRewardPopup } from '@/hooks/useQuestRewardPopup';
import { buildRewardLines } from '@/utils/rewardLines';
import { resolveEquipmentLayers, resolvePlayerBaseSpriteAssetId } from '@/utils/equipmentLayers';
import { enemyMapIconScale } from '@/utils/enemyMapIcon';
import { isTypingTarget } from '@/utils/keyboard';
import { resolveNpcDialogue, hasNewDialogue } from '@/utils/npcDialogue';
import { shrineSpriteAssetId } from '@/utils/shrineRestoration';
import { playMusic, playSound } from '@/audio/audioService';
import type { Npc, WeatherKind } from '@/types';
import { resolveWeather } from '@/utils/weather';
import { STORY_WEATHER_LOCKS } from '@/data/weatherConfig';
import { isOutdoorTopLevelLocation } from '@/utils/location';
import { useTimeOfDayStore } from '@/state/useTimeOfDayStore';
import { useDebugStore } from '@/state/useDebugStore';
import type { TimePhase } from '@/types';
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
  // Crimson Bayou (MSQ Volume II)
  'mother-cypress-shrine': 'shrine',
  'heart-seed-cypress': 'fragment',
  'heart-seed-murkwater': 'fragment',
  'heart-seed-river': 'fragment',
  // Crimson Bayou side quest (The Drowned Ledgers)
  'drowned-ledger-cache': 'fragment',
  'bogwater-almanac-cache': 'fragment',
  // Endless Prairie (MSQ Volume III, Chapter 5)
  'stone-circle-carvings': 'shrine',
  'wind-stone-golden-prairie': 'fragment',
  'wind-stone-spirit-herd-plains': 'fragment',
  'wind-stone-stone-circle-valley': 'fragment',
  // Endless Prairie side quest (The Winter Counts) - see FRAGMENT_SPRITE_ASSET_ID below for their
  // (temporarily reused) marker sprite.
  'winter-count-hide-i-cache': 'fragment',
  'winter-count-hide-ii-cache': 'fragment',
  // Endless Prairie's Charm/Totem-slot-unlock side quests (The Sky's Second Gift / The Herd's
  // Enduring Bond) - refId equals the granted item's own id, same convention every other fragment
  // here follows.
  'prairie-charm-relic': 'fragment',
  'prairie-totem-relic': 'fragment',
  // Whispering Pines (MSQ Volume IV, Chapter 7)
  'cedar-shrine-heart': 'shrine',
  'heartwood-sanctuary-gate': 'shrine',
  'spirit-seed-elder-forest': 'fragment',
  'spirit-seed-silver-river': 'fragment',
  'spirit-seed-heartwood-approach': 'fragment',
  'lost-library-records': 'fragment',
  // Whispering Pines side quest (The Heartwood Recordings)
  'heartwood-recording-i-cache': 'fragment',
  'heartwood-recording-ii-cache': 'fragment',
  // Whispering Pines' Charm/Totem-slot-unlock side quests (The Cedar's Second Ring / Roots That
  // Remember)
  'cedar-charm-relic': 'fragment',
  'cedar-totem-relic': 'fragment',
  // Shattered Desert (MSQ Volume V, Chapter 9)
  'star-crystal-shrine': 'shrine',
  'star-fragment-sunfire-dunes': 'fragment',
  'star-fragment-crimson-canyons': 'fragment',
  'star-fragment-painted-mesas': 'fragment',
  // Shattered Desert side quest (The Desert Relics)
  'desert-relic-i-cache': 'fragment',
  'desert-relic-ii-cache': 'fragment',
  // Shattered Desert's Charm/Totem-slot-unlock side quests (The Star's Second Light / Sands That
  // Endure)
  'desert-charm-relic': 'fragment',
  'desert-totem-relic': 'fragment',
  // Frozen Frontier (MSQ Volume VI, Chapter 11)
  'winter-shrine': 'shrine',
  'aurora-crystal-fragment-snowveil-forest': 'fragment',
  'aurora-crystal-fragment-glacier-pass': 'fragment',
  'aurora-crystal-fragment-aurora-basin': 'fragment',
  // Frozen Frontier side quest (The Missing Scouts)
  'lost-scout-effects-i-cache': 'fragment',
  'lost-scout-effects-ii-cache': 'fragment',
};
/** Which Cloud Function a walk-in `zone` landmark fires the instant the player's tile enters it -
 *  no Interact needed. Hunter's Camp and Spirit Grove (the clearing, not its shrine) are pure
 *  discovery ('visitOnly'); Mossy Creek also grants a key item ('fragment'). */
const ZONE_LANDMARK_KIND: Record<string, 'visitOnly' | 'fragment'> = {
  'hunters-camp': 'visitOnly',
  'spirit-grove': 'visitOnly',
  'mossy-creek': 'fragment',
};

/** Sprite for each 'fragment'-kind point interactable - these are NOT shrines (no lit/dormant
 *  restoration state), so each needs its own bespoke marker rather than falling back to the shrine
 *  sprite. This is the marker shown BEFORE collection - as of the 2026-08-09 found/unfound
 *  retrofit every one of these is now animated ("make the unfound version animated, so the player
 *  knows there is something exploring or waiting to be interacted with"), either via a dedicated
 *  '-glow' registry id or, for water-glimmer (built earlier as its own animated-from-the-start
 *  asset), the base id itself. See FRAGMENT_COLLECTED_SPRITE_ASSET_ID below for the matching
 *  after-collection look. */
const FRAGMENT_SPRITE_ASSET_ID: Record<string, string> = {
  'fallen-watchtower': 'structure.landmark-watchtower-glow',
  'water-fragment': 'structure.landmark-water-glimmer',
  'frostbound-treatise-cache': 'structure.landmark-frost-cache-glow',
  // Crimson Bayou (MSQ Volume II) - all 3 Heart Seed fragments share one marker sprite
  'heart-seed-cypress': 'structure.landmark-heart-seed-glow',
  'heart-seed-murkwater': 'structure.landmark-heart-seed-glow',
  'heart-seed-river': 'structure.landmark-heart-seed-glow',
  // Crimson Bayou side quest (The Drowned Ledgers) - each has its own bespoke marker
  'drowned-ledger-cache': 'structure.landmark-drowned-ledger-cache-glow',
  'bogwater-almanac-cache': 'structure.landmark-bogwater-almanac-cache-glow',
  // Endless Prairie (MSQ Volume III) - all 3 Wind Stone fragments share one marker sprite.
  'wind-stone-golden-prairie': 'structure.landmark-wind-stone-glow',
  'wind-stone-spirit-herd-plains': 'structure.landmark-wind-stone-glow',
  'wind-stone-stone-circle-valley': 'structure.landmark-wind-stone-glow',
  // Endless Prairie side quest (The Winter Counts) - real bespoke markers.
  'winter-count-hide-i-cache': 'structure.landmark-winter-count-hide-i-cache-glow',
  'winter-count-hide-ii-cache': 'structure.landmark-winter-count-hide-ii-cache-glow',
  // Endless Prairie's Charm/Totem-slot-unlock side quests - no bespoke markers generated yet
  // (PixelLab quota), reusing the region's own Wind Stone marker.
  'prairie-charm-relic': 'structure.landmark-wind-stone-glow',
  'prairie-totem-relic': 'structure.landmark-wind-stone-glow',
  // Whispering Pines (MSQ Volume IV) - no bespoke markers generated yet (PixelLab quota), reusing
  // existing thematically-close markers same as the Winter Counts above.
  'spirit-seed-elder-forest': 'structure.landmark-heart-seed-glow',
  'spirit-seed-silver-river': 'structure.landmark-heart-seed-glow',
  'spirit-seed-heartwood-approach': 'structure.landmark-heart-seed-glow',
  'lost-library-records': 'structure.landmark-drowned-ledger-cache-glow',
  'heartwood-recording-i-cache': 'structure.landmark-drowned-ledger-cache-glow',
  'heartwood-recording-ii-cache': 'structure.landmark-bogwater-almanac-cache-glow',
  // Whispering Pines' Charm/Totem-slot-unlock side quests - reusing the region's own Spirit Seed
  // marker.
  'cedar-charm-relic': 'structure.landmark-heart-seed-glow',
  'cedar-totem-relic': 'structure.landmark-heart-seed-glow',
  // Shattered Desert (MSQ Volume V)
  'star-fragment-sunfire-dunes': 'structure.landmark-water-glimmer',
  'star-fragment-crimson-canyons': 'structure.landmark-water-glimmer',
  'star-fragment-painted-mesas': 'structure.landmark-water-glimmer',
  'desert-relic-i-cache': 'structure.landmark-drowned-ledger-cache-glow',
  'desert-relic-ii-cache': 'structure.landmark-bogwater-almanac-cache-glow',
  // Shattered Desert's Charm/Totem-slot-unlock side quests - reusing the region's own Star
  // Fragment marker.
  'desert-charm-relic': 'structure.landmark-water-glimmer',
  'desert-totem-relic': 'structure.landmark-water-glimmer',
  // Frozen Frontier (MSQ Volume VI)
  'aurora-crystal-fragment-snowveil-forest': 'structure.landmark-water-glimmer',
  'aurora-crystal-fragment-glacier-pass': 'structure.landmark-water-glimmer',
  'aurora-crystal-fragment-aurora-basin': 'structure.landmark-water-glimmer',
  'lost-scout-effects-i-cache': 'structure.landmark-drowned-ledger-cache-glow',
  'lost-scout-effects-ii-cache': 'structure.landmark-bogwater-almanac-cache-glow',
};

// grantedItemIdFor (refId -> granted itemId, for the minority of world-item interactables whose
// refId doesn't equal the granted item's own id) now lives in src/utils/worldItems.ts, shared with
// DungeonScene.tsx - see that file's doc comment for the 2026-08-10 bug this guards against.

/** Post-collection sprite for a 'fragment'-kind interactable, shown once its item is in the
 *  player's inventory (collectWorldItem.ts grants it once and never removes it, so presence in
 *  inventory IS the "collected" flag - same convention DungeonScene.tsx's isWorldItemCollected
 *  uses). Derived from FRAGMENT_SPRITE_ASSET_ID rather than a second hand-maintained table - every
 *  entry there now has a matching '<base-id>-collected' registry asset (the 2026-08-09
 *  found/unfound retrofit), so a future new fragment refId can't silently ship with no collected
 *  sprite wired the way every fragment before the Heart Seeds once did. Strips a trailing '-glow'
 *  first since the unfound id is the *animated* variant (e.g. 'landmark-watchtower-glow') while
 *  the collected id is named off the base marker (e.g. 'landmark-watchtower-collected') - water-
 *  glimmer's unfound id has no '-glow' suffix (it was built animated-from-the-start under its base
 *  id), so it passes through unchanged. */
function fragmentCollectedSpriteAssetId(refId: string): string | undefined {
  const unfoundId = FRAGMENT_SPRITE_ASSET_ID[refId];
  if (!unfoundId) return undefined;
  const baseId = unfoundId.endsWith('-glow') ? unfoundId.slice(0, -'-glow'.length) : unfoundId;
  return `${baseId}-collected`;
}

/** Display name for a shrine-kind point interactable (POINT_LANDMARK_KIND[refId] === 'shrine')
 *  whose refId doesn't double as its own LOCATIONS entry the way mother-cypress-shrine/stone-
 *  circle-carvings do (they sit inside a larger field map that already has its own Location id) -
 *  without an explicit entry here these fell all the way through to labelForInteractable's
 *  'something' fallback. */
const SHRINE_LABEL: Record<string, string> = {
  'cedar-shrine-heart': 'Ancient Cedar Shrine',
  'heartwood-sanctuary-gate': 'Heartwood Sanctuary Gate',
  'star-crystal-shrine': 'Star Crystal Shrine',
  'winter-shrine': 'Winter Shrine',
};

/** Flavor-text label for each 'fragment'-kind point interactable, pre-collection - one entry per
 *  refId in FRAGMENT_SPRITE_ASSET_ID above (a fragment's label and its marker sprite are looked up
 *  from the same set of ids, just never needed to be the same table). */
const FRAGMENT_LABEL: Record<string, string> = {
  'fallen-watchtower': 'a crumbling watchtower, wind-worn and abandoned',
  'water-fragment': 'a faint glimmer in the pool',
  'frostbound-treatise-cache': 'a hidden cache behind the falls',
  'heart-seed-cypress': 'a seed pod nestled among mossy roots, glowing faintly',
  'heart-seed-murkwater': 'a seed pod nestled among mossy roots, glowing faintly',
  'heart-seed-river': 'a seed pod nestled among mossy roots, glowing faintly',
  'drowned-ledger-cache': 'a hidden cache in the reeds',
  'bogwater-almanac-cache': 'a mossy cypress hollow',
  'wind-stone-golden-prairie': 'a stone humming faintly with wind',
  'wind-stone-spirit-herd-plains': 'a stone humming faintly with wind',
  'wind-stone-stone-circle-valley': 'a stone humming faintly with wind',
  'winter-count-hide-i-cache': 'a painted hide half-buried in the grass',
  'winter-count-hide-ii-cache': 'a painted hide half-buried in the grass',
  'prairie-charm-relic': 'a wind-worn relic, humming with old spirit-craft',
  'prairie-totem-relic': 'a wind-worn relic, humming with old spirit-craft',
  'spirit-seed-elder-forest': 'a seed pod humming faintly with spirit-light',
  'spirit-seed-silver-river': 'a seed pod humming faintly with spirit-light',
  'spirit-seed-heartwood-approach': 'a seed pod humming faintly with spirit-light',
  'lost-library-records': 'a bundle of forgotten records',
  'heartwood-recording-i-cache': 'a hidden recording, tucked out of sight',
  'heartwood-recording-ii-cache': 'a hidden recording, tucked out of sight',
  'cedar-charm-relic': 'a cedar-carved relic, humming with old spirit-craft',
  'cedar-totem-relic': 'a cedar-carved relic, humming with old spirit-craft',
  'star-fragment-sunfire-dunes': 'a shard of crystal that catches starlight',
  'star-fragment-crimson-canyons': 'a shard of crystal that catches starlight',
  'star-fragment-painted-mesas': 'a shard of crystal that catches starlight',
  'desert-relic-i-cache': 'a carved relic half-buried in the sand',
  'desert-relic-ii-cache': 'a carved relic half-buried in the sand',
  'desert-charm-relic': 'a sun-worn relic, humming with old spirit-craft',
  'desert-totem-relic': 'a sun-worn relic, humming with old spirit-craft',
  'aurora-crystal-fragment-snowveil-forest': 'a shard of ice holding a faint trace of aurora-light',
  'aurora-crystal-fragment-glacier-pass': 'a shard of ice holding a faint trace of aurora-light',
  'aurora-crystal-fragment-aurora-basin': 'a shard of ice holding a faint trace of aurora-light',
  'lost-scout-effects-i-cache': "a lost scout's frozen pack",
  'lost-scout-effects-ii-cache': "a lost scout's frozen pack",
};

/** Display name for any interactable on this map, shared between the entity labels and the
 *  "nothing to do here yet" fallback message so they never drift out of sync. */
function labelForInteractable(refId: string, openedChests: string[], inventory: { itemId: string }[]): string {
  if (refId.startsWith('chest-')) return openedChests.includes(refId) ? 'Empty Chest' : 'Chest';
  if (SHRINE_LABEL[refId]) return SHRINE_LABEL[refId];
  // A fragment-kind refId IS its own granted itemId (collectWorldItem.ts) - once it's in the
  // player's inventory the flavor text below (describing something still hidden/waiting) is no
  // longer accurate, same staleness the sprite swap above already fixes for the visual.
  if (inventory.some((i) => i.itemId === grantedItemIdFor(refId))) return 'Already Collected';
  if (FRAGMENT_LABEL[refId]) return FRAGMENT_LABEL[refId];
  const decorEntity = resolveDecorEntity(refId);
  if (decorEntity) return decorEntity.label;
  const landmark = LOCATIONS.find((l) => l.id === refId);
  if (landmark) return landmark.name;
  return 'something';
}

export function OverworldScene() {
  const locationId = useSceneStore((s) => s.params.locationId) ?? 'ironwood-trail';
  const goTo = useSceneStore((s) => s.goTo);
  // Region-specific theme when the location defines one, falling back to the generic overworld
  // track otherwise - playMusic no-ops if it's already playing, so crossing between locations that
  // share a track doesn't restart it. Re-runs on locationId change (fast travel, a transition into
  // a new region) - see handleActiveZonesChange below for the subarea override layered on top of
  // this base track while standing inside a landmark zone (Hunter's Camp, Spirit Grove, etc).
  useEffect(() => {
    const location = LOCATIONS.find((l) => l.id === locationId);
    void playMusic(location?.musicAssetId ?? 'music.overworld');
  }, [locationId]);
  // Fires whenever the set of `zone` map objects the player is standing inside changes (see
  // ExplorationScene's onActiveZonesChange). Landmark subareas sharing this map (parentLocationId
  // === locationId) with their own musicAssetId override the region's base track while the player
  // is inside them; leaving reverts to it. Picks the first matching zone if more than one somehow
  // overlaps - real map layouts don't nest landmark zones today, so this is just a tiebreak, not a
  // load-bearing design choice.
  function handleActiveZonesChange(refIds: string[]) {
    const activeSubarea = refIds
      .map((refId) => LOCATIONS.find((l) => l.id === refId && l.parentLocationId === locationId))
      .find((l) => l?.musicAssetId);
    const baseLocation = LOCATIONS.find((l) => l.id === locationId);
    void playMusic(activeSubarea?.musicAssetId ?? baseLocation?.musicAssetId ?? 'music.overworld');
  }
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const questProgress = useQuestStore((s) => s.progress);
  const hiddenQuestIds = useMapPreferencesStore((s) => s.hiddenQuestIds);
  // Rolled fresh each time the player (re)arrives at a top-level location - stable for the
  // visit, varied across visits (see src/utils/weather.ts's resolveWeather). Reads progress via
  // getState() rather than the reactive `questProgress` above so an unrelated quest updating
  // elsewhere doesn't re-roll the weather out from under the player mid-visit.
  const [weather, setWeather] = useState<WeatherKind | null>(null);
  useEffect(() => {
    setWeather(resolveWeather(locationId, useQuestStore.getState().progress));
  }, [locationId]);
  // If this location's own weather-lock quest completes while the player is standing here (not
  // just on the next visit), clear the lock immediately - keyed on that one quest's status only,
  // not all of `questProgress`, so it doesn't fire on unrelated quest progress.
  const lockQuestId = STORY_WEATHER_LOCKS[locationId]?.questId;
  const lockQuestStatus = lockQuestId ? questProgress[lockQuestId]?.status : undefined;
  useEffect(() => {
    setWeather(resolveWeather(locationId, useQuestStore.getState().progress));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockQuestStatus]);
  // Debug tab overrides (UserProfile's Debug tab, see useDebugStore) - reactive, so flipping one
  // while standing in a location takes effect immediately rather than waiting for the next visit.
  // Both stay gated by the same outdoor-eligibility check as normal resolution, so forcing an
  // override can't show weather/lighting somewhere it structurally never applies.
  const outdoorEligible = isOutdoorTopLevelLocation(locationId);
  const timeOfDayPhase = useTimeOfDayStore((s) => s.phase);
  const debugWeatherOverride = useDebugStore((s) => s.weatherOverride);
  const debugTimeOverride = useDebugStore((s) => s.timeOverride);
  const debugShowCollisions = useDebugStore((s) => s.showCollisions);
  const effectiveWeather = outdoorEligible ? (debugWeatherOverride ?? weather) : null;
  const effectiveTimePhase: TimePhase = outdoorEligible ? (debugTimeOverride ?? timeOfDayPhase) : 'day';
  const openedChests = useWorldStateStore((s) => s.openedChests);
  const seenNpcDialogueVariant = useWorldStateStore((s) => s.seenNpcDialogueVariant);
  const inventory = useInventoryStore((s) => s.items);
  const locationsVisited = useJournalStore((s) => s.journal.locationsVisited);
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const gender = usePlayerStore((s) => s.player?.gender ?? 'male');
  const appearance = usePlayerStore((s) => s.player?.appearance ?? 'white-dark');
  const equipment = usePlayerStore((s) => s.player?.equipment);
  const equipmentLayers = useMemo(() => resolveEquipmentLayers(equipment, gender), [equipment, gender]);
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { currentLorePopup, queueLorePopups, dismissCurrentLorePopup } = useLorePopupQueue();
  // Shared reward-acknowledgment popup (see RewardPopup.tsx) - shown for chest opens/world-item
  // pickups (always, via setRewardPopup directly) and for a quest completed by a talk/enter/
  // visit/shrine event (only when it actually granted something, via showQuestRewardPopup).
  const { rewardPopup, setRewardPopup, showQuestRewardPopup } = useQuestRewardPopup(queueLorePopups);
  const isMobile = useIsMobile();
  const battleOverlayOpen = useBattleOverlayStore((s) => s.isOpen);
  const hudBarHeight = useHudBarHeight();
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const otherOverlaysOpen =
    activeNpc !== null || menuOpen || journalOpen || message !== null || rewardPopup !== null || currentLorePopup !== null;
  const { mapOpen, toggleMap, closeMap } = useMapOverlay(otherOverlaysOpen);
  const suspended = otherOverlaysOpen || mapOpen;
  const { pending, run } = usePendingAction();

  // Shared by handleZoneEnter's 'fragment' zone case and attemptInteract's POINT_LANDMARK_KIND
  // 'fragment' case - identical server call + reward-popup wiring, only whether an already-
  // collected fragment is worth a round-trip differs (see handleZoneEnter's own early-return
  // below), so that check stays with each caller rather than folded in here.
  function collectFragment(refId: string) {
    run(() => callCollectWorldItem(locationId, refId), 'Collecting...')
      ?.then(async (res) => {
        if (uid) await resyncSave(uid);
        if (res.alreadyCollected) {
          setMessage("There's nothing left to find here.");
          return;
        }
        queueLorePopups(res.questRewards?.grantedLoreIds);
        setRewardPopup({
          title: 'You found...',
          lines: buildRewardLines({
            itemIds: [res.itemId],
            xp: res.questRewards?.xp,
            gold: res.questRewards?.gold,
            spiritEssence: res.questRewards?.spiritEssence,
            skillIds: res.questRewards?.grantedSkillIds,
          }),
        });
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Nothing happens.'));
  }

  function handleZoneEnter(refId: string) {
    const kind = ZONE_LANDMARK_KIND[refId];
    if (kind === 'fragment') {
      // Already in inventory (grantedItemIdFor/collectWorldItem.ts's own "collected" convention -
      // see this file's own resolveDecorEntity-adjacent comment) - skip the round-trip and the
      // "nothing left to find" popup entirely, rather than showing it every single time the player
      // walks back through an already-emptied zone. Nothing is lost by skipping the server call
      // here: a unique world-item grant is idempotent server-side too, this is purely avoiding a
      // pointless call + an interruption for a state the client already knows for certain.
      if (inventory.some((i) => i.itemId === grantedItemIdFor(refId))) return;
      collectFragment(refId);
      return;
    }
    if (kind === 'visitOnly') {
      // Same idea as the fragment case above - journal.locationsVisited is exactly what
      // visitLandmark.ts's own alreadyVisited check reads server-side, so a landmark already in
      // it is a sure thing client-side too. Skips the "you've already explored X" popup for every
      // pass back through a landmark zone the player has already investigated once.
      if (locationsVisited.includes(refId)) return;
      const landmarkName = LOCATIONS.find((l) => l.id === refId)?.name ?? refId;
      run(() => callVisitLandmark(refId), 'Investigating...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          if (res.alreadyVisited) {
            setMessage(`You've already explored ${landmarkName}.`);
          } else if (res.questRewards) {
            showQuestRewardPopup(res.questRewards);
          } else {
            setMessage(`You find ${landmarkName}. Perhaps it will mean something, in time.`);
          }
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'You cannot linger here.'));
    }
  }

  const { map, position, positionRef, spawnPosition, reportPosition, movementInput, wanderPositions, handleTransitionEnter } =
    useLocationExploration({
      locationId,
      suspended,
      onBlockedTransition: setMessage,
    });
  const { icons: fieldEncounterIcons, consumeAt: consumeFieldEncounterAt } = useFieldEncounters(map, locationId, positionRef);
  const gridRef = useRef<TileGridHandle>(null);

  function handleFieldEncounterNear(icon: { id: string; x: number; y: number }) {
    const consumed = consumeFieldEncounterAt(icon.x, icon.y);
    if (consumed) goTo('combat', { locationId, spawnX: icon.x, spawnY: icon.y });
  }

  useHeartbeat(uid, displayName, locationId, position, gender, appearance, equipment);
  useDragMovement(gridWrapperRef, movementInput.setDirectionHeld, isMobile && !suspended);
  const { startDash, stopDash } = useExplorationDash(movementInput.setDashHeld, staminaUnlocked && !suspended);

  function attemptInteract() {
    if (suspended || !map) return;
    // Pixel-space directional probe (see ExplorationScene.ts's queryInteraction) - replaces the
    // old exact-facing-tile lookup. `result.id` is the matched npc/interactable's own refId.
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

    // result.kind === 'interactable' (presence isn't rendered/interactable in Overworld)
    const refId = result.id;
    if (refId.startsWith('chest-')) {
      const chestId = refId;
      run(() => callOpenChest(locationId, chestId), 'Opening chest...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          if (res.alreadyOpened) {
            setMessage('You already emptied this chest.');
            return;
          }
          void playSound('sfx.chest-open');
          setRewardPopup({
            title: 'You found...',
            subtitle: 'Chest',
            lines: buildRewardLines({
              gold: res.gold,
              xp: res.xp,
              itemIds: Array(res.itemQuantity ?? 1).fill(res.itemId),
            }),
          });
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The chest will not open.'));
      return;
    }
    if (POINT_LANDMARK_KIND[refId] === 'shrine') {
      const landmarkName = LOCATIONS.find((l) => l.id === refId)?.name ?? refId;
      run(() => callInteractWithShrine(locationId, refId), 'Interacting with shrine...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          void playSound('sfx.shrine');
          if (res.unlockedStamina) {
            setMessage(
              `The shrine at ${landmarkName} kindles fully alight once more. You feel the trail's strength answer you - Stamina is yours to command now.`,
            );
          } else if (res.questRewards) {
            showQuestRewardPopup(res.questRewards);
          } else {
            setMessage(`You have found ${landmarkName}. A shrine stands here, long neglected.`);
          }
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The shrine does not respond.'));
      return;
    }
    if (POINT_LANDMARK_KIND[refId] === 'fragment') {
      collectFragment(refId);
      return;
    }
    const label = labelForInteractable(refId, openedChests, inventory);
    setMessage(`You find ${label.startsWith('Empty') ? 'an ' + label.toLowerCase() : 'a ' + label.toLowerCase()}. Perhaps it will mean something, in time.`);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (e.key === 'Escape') {
        if (rewardPopup) setRewardPopup(null);
        else if (currentLorePopup) dismissCurrentLorePopup();
        else if (activeNpc) setActiveNpc(null);
        else if (message) setMessage(null);
        else if (menuOpen) setMenuOpen(false);
        else if (journalOpen) setJournalOpen(false);
        return;
      }
      // Blocks *opening* a new overlay while one of these is already up (a stacked pair then
      // shares one Escape-close and closes together); doesn't block closing the same overlay
      // back off via its own key.
      const blockingOverlayOpen = activeNpc !== null || message !== null || rewardPopup !== null || currentLorePopup !== null;
      if (e.key === 'i' || e.key === 'I') {
        if (menuOpen || !blockingOverlayOpen) setMenuOpen((open) => !open);
        return;
      }
      if (e.key === 'j' || e.key === 'J') {
        if (journalOpen || !blockingOverlayOpen) setJournalOpen((open) => !open);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') attemptInteract();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewardPopup, currentLorePopup, activeNpc, message, menuOpen, journalOpen, map, uid, questProgress]);

  // Memoized so a re-render caused by unrelated state (message/menuOpen/etc.) doesn't hand
  // TileGrid a brand-new array reference every time - PhaserExplorationCanvas re-runs
  // setEntities(entities) whenever this reference changes, which is wasted work when nothing
  // about the entities themselves actually changed. Must run unconditionally (before the `!map`
  // early return below) - hooks can never be skipped on some renders and not others.
  const entities = useMemo<GridEntity[]>(() => {
    if (!map) return [];
    // Same target-resolution rules as MiniMap.tsx's own "quest gold ring" (see
    // questTargetLookup.ts) - lets a quest-target NPC/interactable/exit show the floating marker
    // ExplorationScene.ts renders above its head, not just on the map overlay.
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
          // (NPC_WALK_ASSET_IDS) - see TownScene.tsx's identical wiring for the full explanation.
          movementState: pos.isMoving ? 'walking' : undefined,
          facing: pos.facing,
          blocksMovement: true,
          interactionKind: 'npc',
        };
      });

    const interactableEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'interactable' && o.refId)
      .map((o) => {
        const isChest = o.refId!.startsWith('chest-');
        const isShrine = POINT_LANDMARK_KIND[o.refId!] === 'shrine';
        const decorEntity = resolveDecorEntity(o.refId!);
        const spriteAssetId = isChest
          ? openedChests.includes(o.refId!)
            ? 'structure.chest-open'
            : 'structure.chest'
          : isShrine
            ? shrineSpriteAssetId(o.refId!, questProgress)
            : decorEntity
              ? decorEntity.spriteAssetId
              : inventory.some((i) => i.itemId === grantedItemIdFor(o.refId!))
                ? (fragmentCollectedSpriteAssetId(o.refId!) ?? FRAGMENT_SPRITE_ASSET_ID[o.refId!] ?? 'structure.shrine-dormant')
                : (FRAGMENT_SPRITE_ASSET_ID[o.refId!] ?? 'structure.shrine-dormant');
        // No floating name tag for chests or purely ambient decor (fireplace, mushrooms, every
        // general-* station prop) - only quest-relevant interactables (fragments/lore caches,
        // named shrine landmarks) and shrines keep one. The "You find a X" flavor message
        // (attemptInteract above) still calls labelForInteractable itself - only this floating tag
        // is suppressed here.
        return {
          id: o.refId!,
          x: o.x,
          y: o.y,
          spriteAssetId,
          label: isChest || decorEntity ? undefined : labelForInteractable(o.refId!, openedChests, inventory),
          questTarget: activeQuestTargetRefIds.has(o.refId!),
          blocksMovement: true,
        };
      });

    const fieldEncounterEntities: GridEntity[] = fieldEncounterIcons.map((icon) => ({
      id: icon.id,
      x: icon.x,
      y: icon.y,
      spriteAssetId: icon.spriteAssetId,
      displayScale: enemyMapIconScale(icon.spriteAssetId, icon.isBoss),
      hasShadow: true,
    }));

    // Every transition (region-to-region crossings) gets a visible pulsing exit marker instead of
    // looking like plain ground - same generic marker as TownScene's interior exits.
    const exitEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'transition' && o.refId)
      .map((o) => ({
        id: `exit-${o.refId}`,
        x: o.x,
        y: o.y,
        spriteAssetId: 'structure.exit-marker',
        label: 'Exit',
        questTarget: activeQuestTargetRefIds.has(o.refId!),
      }));

    return [...npcEntities, ...interactableEntities, ...exitEntities, ...fieldEncounterEntities];
  }, [map, wanderPositions, questProgress, hiddenQuestIds, seenNpcDialogueVariant, openedChests, fieldEncounterIcons, inventory]);

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
          ref={gridRef}
          map={map}
          player={spawnPosition}
          playerSpriteAssetId={resolvePlayerBaseSpriteAssetId(gender, appearance)}
          movementInputRef={movementInput.inputRef}
          suspended={suspended}
          onPositionChange={reportPosition}
          onZoneEnter={handleZoneEnter}
          onActiveZonesChange={handleActiveZonesChange}
          onTransitionEnter={handleTransitionEnter}
          fieldEncounterIcons={fieldEncounterIcons}
          onFieldEncounterNear={handleFieldEncounterNear}
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
      {rewardPopup && (
        <RewardPopup title={rewardPopup.title} subtitle={rewardPopup.subtitle} lines={rewardPopup.lines} onClose={() => setRewardPopup(null)} />
      )}
      {!rewardPopup && currentLorePopup && (
        <LorePopup title={currentLorePopup.title} body={currentLorePopup.body} onClose={dismissCurrentLorePopup} />
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
