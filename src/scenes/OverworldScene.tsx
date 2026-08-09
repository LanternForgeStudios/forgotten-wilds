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
import { useInventoryStore } from '@/state/useInventoryStore';
import { useBattleOverlayStore } from '@/state/useBattleOverlayStore';
import {
  callOpenChest,
  callVisitLandmark,
  callCollectWorldItem,
  callInteractWithShrine,
  callTalkToNpc,
  type QuestRewardSummary,
} from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { LOCATIONS, NPCS } from '@/data';
import { RewardPopup } from '@/components/RewardPopup';
import { buildRewardLines, type RewardLine } from '@/utils/rewardLines';
import { resolveEquipmentLayers, resolvePlayerBaseSpriteAssetId } from '@/utils/equipmentLayers';
import { enemyMapIconScale } from '@/utils/enemyMapIcon';
import { isTypingTarget } from '@/utils/keyboard';
import { resolveNpcDialogue, hasNewDialogue } from '@/utils/npcDialogue';
import { shrineSpriteAssetId } from '@/utils/shrineRestoration';
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
  'ember-codex-tunnel': 'structure.landmark-tunnel-entrance-glow',
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

/** Purely decorative, non-gated interactable - no Cloud Function call, falls through to
 *  attemptInteract's generic "you find X" flavor branch at the bottom (labelForInteractable
 *  below supplies the label). Multiple instances per map share this refId prefix (each with a
 *  unique numeric suffix, same convention as chest-<location>-<n>). */
function isGlowingMushroom(refId: string): boolean {
  return refId.startsWith('glowing-mushroom');
}

/** Display name for any interactable on this map, shared between the entity labels and the
 *  "nothing to do here yet" fallback message so they never drift out of sync. */
function labelForInteractable(refId: string, openedChests: string[], inventory: { itemId: string }[]): string {
  if (refId.startsWith('chest-')) return openedChests.includes(refId) ? 'Empty Chest' : 'Chest';
  // A fragment-kind refId IS its own granted itemId (collectWorldItem.ts) - once it's in the
  // player's inventory the flavor text below (describing something still hidden/waiting) is no
  // longer accurate, same staleness the sprite swap above already fixes for the visual.
  if (inventory.some((i) => i.itemId === refId)) return 'Already Collected';
  if (refId === 'water-fragment') return 'a faint glimmer in the pool';
  if (refId === 'frostbound-treatise-cache') return 'a hidden cache behind the falls';
  if (refId === 'ember-codex-tunnel') return 'an overlooked maintenance tunnel';
  if (refId === 'drowned-ledger-cache') return 'a hidden cache in the reeds';
  if (refId === 'bogwater-almanac-cache') return 'a mossy cypress hollow';
  if (refId.startsWith('wind-stone-')) return 'a stone humming faintly with wind';
  if (refId === 'winter-count-hide-i-cache' || refId === 'winter-count-hide-ii-cache') return 'a painted hide half-buried in the grass';
  if (refId === 'prairie-charm-relic' || refId === 'prairie-totem-relic') return 'a wind-worn relic, humming with old spirit-craft';
  if (refId.startsWith('spirit-seed-')) return 'a seed pod humming faintly with spirit-light';
  if (refId === 'lost-library-records') return 'a bundle of forgotten records';
  if (refId === 'heartwood-recording-i-cache' || refId === 'heartwood-recording-ii-cache') return 'a hidden recording, tucked out of sight';
  if (refId === 'cedar-charm-relic' || refId === 'cedar-totem-relic') return 'a cedar-carved relic, humming with old spirit-craft';
  if (refId.startsWith('star-fragment-')) return 'a shard of crystal that catches starlight';
  if (refId === 'desert-relic-i-cache' || refId === 'desert-relic-ii-cache') return 'a carved relic half-buried in the sand';
  if (refId === 'desert-charm-relic' || refId === 'desert-totem-relic') return 'a sun-worn relic, humming with old spirit-craft';
  if (refId.startsWith('aurora-crystal-fragment-')) return 'a shard of ice holding a faint trace of aurora-light';
  if (refId === 'lost-scout-effects-i-cache' || refId === 'lost-scout-effects-ii-cache') return "a lost scout's frozen pack";
  if (refId.startsWith('glowing-mushroom')) return 'Glowing Mushroom';
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
  const inventory = useInventoryStore((s) => s.items);
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const gender = usePlayerStore((s) => s.player?.gender ?? 'male');
  const appearance = usePlayerStore((s) => s.player?.appearance ?? 'white-dark');
  const equipment = usePlayerStore((s) => s.player?.equipment);
  const equipmentLayers = useMemo(() => resolveEquipmentLayers(equipment, gender), [equipment, gender]);
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Shared reward-acknowledgment popup (see RewardPopup.tsx) - shown for chest opens/world-item
  // pickups (always) and for a quest completed by a talk/enter/visit/shrine event (only when it
  // actually granted something, since most of those events complete no quest at all).
  const [rewardPopup, setRewardPopup] = useState<{ title: string; subtitle?: string; lines: RewardLine[] } | null>(null);
  function showQuestRewardPopup(questRewards: QuestRewardSummary | null) {
    if (!questRewards) return;
    setRewardPopup({
      title: 'Quest Complete!',
      lines: buildRewardLines({
        xp: questRewards.xp,
        gold: questRewards.gold,
        itemIds: questRewards.itemIds,
        skillIds: questRewards.grantedSkillIds,
      }),
    });
  }
  const isMobile = useIsMobile();
  const battleOverlayOpen = useBattleOverlayStore((s) => s.isOpen);
  const hudBarHeight = useHudBarHeight();
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const otherOverlaysOpen = activeNpc !== null || menuOpen || journalOpen || message !== null || rewardPopup !== null;
  const { mapOpen, toggleMap, closeMap } = useMapOverlay(otherOverlaysOpen);
  const suspended = otherOverlaysOpen || mapOpen;
  const { pending, run } = usePendingAction();

  function handleZoneEnter(refId: string) {
    const kind = ZONE_LANDMARK_KIND[refId];
    if (kind === 'fragment') {
      run(() => callCollectWorldItem(locationId, refId), 'Collecting...')
        ?.then(async (res) => {
          if (uid) await resyncSave(uid);
          if (res.alreadyCollected) {
            setMessage("There's nothing left to find here.");
            return;
          }
          setRewardPopup({
            title: 'You found...',
            lines: buildRewardLines({
              itemIds: [res.itemId],
              xp: res.questRewards?.xp,
              gold: res.questRewards?.gold,
              skillIds: res.questRewards?.grantedSkillIds,
            }),
          });
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'Nothing happens.'));
      return;
    }
    if (kind === 'visitOnly') {
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

  useHeartbeat(uid, displayName, locationId, position, gender);
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
          ?.then(async (res) => {
            if (uid) await resyncSave(uid);
            showQuestRewardPopup(res.questRewards);
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
          if (res.alreadyOpened) {
            setMessage('You already emptied this chest.');
            return;
          }
          void playSound('sfx.chest-open');
          setRewardPopup({ title: 'You found...', subtitle: 'Chest', lines: buildRewardLines({ itemIds: [res.itemId] }) });
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
          } else if (res.questRewards) {
            showQuestRewardPopup(res.questRewards);
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
          if (res.alreadyCollected) {
            setMessage("There's nothing left to find here.");
            return;
          }
          setRewardPopup({
            title: 'You found...',
            lines: buildRewardLines({
              itemIds: [res.itemId],
              xp: res.questRewards?.xp,
              gold: res.questRewards?.gold,
              skillIds: res.questRewards?.grantedSkillIds,
            }),
          });
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'Nothing happens.'));
      return;
    }
    if (obj?.refId) {
      const label = labelForInteractable(obj.refId, openedChests, inventory);
      setMessage(`You find ${label.startsWith('Empty') ? 'an ' + label.toLowerCase() : 'a ' + label.toLowerCase()}. Perhaps it will mean something, in time.`);
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (e.key === 'Escape') {
        if (rewardPopup) setRewardPopup(null);
        else if (activeNpc) setActiveNpc(null);
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
  }, [rewardPopup, activeNpc, message, menuOpen, journalOpen, map, position, facingDelta, uid, questProgress, wanderPositions]);

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
          // (NPC_WALK_ASSET_IDS) - see TownScene.tsx's identical wiring for the full explanation.
          movementState: pos.isMoving ? 'walking' : undefined,
          facing: pos.facing,
        };
      });

    const interactableEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'interactable' && o.refId)
      .map((o) => {
        const isChest = o.refId!.startsWith('chest-');
        const isShrine = POINT_LANDMARK_KIND[o.refId!] === 'shrine';
        const spriteAssetId = isChest
          ? openedChests.includes(o.refId!)
            ? 'structure.chest-open'
            : 'structure.chest'
          : isShrine
            ? shrineSpriteAssetId(o.refId!, questProgress)
            : isGlowingMushroom(o.refId!)
              ? 'structure.decor-glowing-mushroom'
              : inventory.some((i) => i.itemId === o.refId)
                ? (fragmentCollectedSpriteAssetId(o.refId!) ?? FRAGMENT_SPRITE_ASSET_ID[o.refId!] ?? 'structure.shrine-dormant')
                : (FRAGMENT_SPRITE_ASSET_ID[o.refId!] ?? 'structure.shrine-dormant');
        return {
          id: o.refId!,
          x: o.x,
          y: o.y,
          spriteAssetId,
          label: labelForInteractable(o.refId!, openedChests, inventory),
        };
      });

    const fieldEncounterEntities: GridEntity[] = fieldEncounterIcons.map((icon) => ({
      id: icon.id,
      x: icon.x,
      y: icon.y,
      spriteAssetId: icon.spriteAssetId,
      displayScale: enemyMapIconScale(icon.spriteAssetId, icon.isBoss),
    }));

    // Every transition (region-to-region crossings) gets a visible pulsing exit marker instead of
    // looking like plain ground - same generic marker as TownScene's interior exits.
    const exitEntities: GridEntity[] = map.objects
      .filter((o) => o.type === 'transition' && o.refId)
      .map((o) => ({ id: `exit-${o.refId}`, x: o.x, y: o.y, spriteAssetId: 'structure.exit-marker', label: 'Exit' }));

    return [...npcEntities, ...interactableEntities, ...exitEntities, ...fieldEncounterEntities];
  }, [map, wanderPositions, questProgress, seenNpcDialogueVariant, openedChests, fieldEncounterIcons, inventory]);

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
