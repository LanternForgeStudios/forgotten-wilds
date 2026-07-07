import { useEffect, useRef, useState } from 'react';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { MobileHud } from '@/components/exploration/MobileHud';
import { DirectionPad } from '@/components/exploration/DirectionPad';
import { DialogueBox } from '@/components/DialogueBox';
import { PlayerHUD } from '@/components/PlayerHUD';
import { CharacterMenu } from '@/components/CharacterMenu';
import { Shop } from '@/components/Shop';
import { Inn } from '@/components/Inn';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { Panel } from '@/components/common/Panel';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { usePendingAction } from '@/hooks/usePendingAction';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useExplorationViewport, HUD_BAR_HEIGHT } from '@/hooks/useExplorationViewport';
import { useDragMovement } from '@/hooks/useDragMovement';
import { useDash } from '@/hooks/useDash';
import { useDashKeybind } from '@/hooks/useDashKeybind';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useQuestStore } from '@/state/useQuestStore';
import { useSceneStore } from '@/state/useSceneStore';
import { callTalkToNpc, callInteractWithShrine } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { subscribeToPresence } from '@/firebase/presenceService';
import { NPCS } from '@/data';
import type { Npc, OnlinePresence } from '@/types';
import { isTypingTarget } from '@/utils/keyboard';
import { resolveNpcDialogue } from '@/utils/npcDialogue';
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
};

/** Shrine interactables on the open town map (currently just Ash Hallow's Town Shrine) - handled
 *  the same way OverworldScene routes shrine landmarks through interactWithShrine. */
const SHRINES = new Set(['ash-hallow-shrine']);

export function TownScene() {
  const locationId = useSceneStore((s) => s.params.locationId) ?? 'ash-hallow';
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [activeShopId, setActiveShopId] = useState<string | undefined>();
  const [innOpen, setInnOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const questProgress = useQuestStore((s) => s.progress);
  const isMobile = useIsMobile();
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const suspended = activeNpc !== null || menuOpen || shopOpen || innOpen || journalOpen || message !== null;
  const { map, position, positionRef, facingDelta, attemptMove, wanderPositions } = useLocationExploration({
    locationId,
    suspended,
    onBlockedTransition: setMessage,
  });
  const [presences, setPresences] = useState<OnlinePresence[]>([]);
  const { pending, run } = usePendingAction();

  useHeartbeat(uid, displayName, locationId, position);
  useDragMovement(gridWrapperRef, attemptMove, isMobile && !suspended);
  const dash = useDash({ attemptMove, positionRef });
  useDashKeybind(dash, staminaUnlocked && !suspended);

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
        run(callTalkToNpc(npc.id))
          .then(async () => {
            if (uid) await resyncSave(uid);
          })
          .catch((err) => console.error('talkToNpc failed', err));
      }
      return;
    }
    const shrineObject = map.objects.find(
      (o) => o.type === 'interactable' && o.refId && SHRINES.has(o.refId) && o.x === target.x && o.y === target.y,
    );
    if (shrineObject?.refId) {
      const refId = shrineObject.refId;
      run(callInteractWithShrine(locationId, refId))
        .then(async (res) => {
          if (uid) await resyncSave(uid);
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
      if (e.key !== 'Enter' && e.key !== ' ') return;
      attemptInteract();
    }
    window.addEventListener('keydown', handleInteract);
    return () => window.removeEventListener('keydown', handleInteract);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNpc, message, menuOpen, shopOpen, innOpen, journalOpen, map, position, facingDelta, uid, wanderPositions]);

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Arriving in Ash Hallow...</p>
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
    .map((o) => ({ id: o.refId!, x: o.x, y: o.y, spriteAssetId: 'structure.shrine', label: 'Shrine' }));

  const now = Date.now();
  const otherPlayerEntities: GridEntity[] = presences
    .filter(
      (p) =>
        p.uid !== uid && p.locationId === locationId && now - p.lastHeartbeat < PRESENCE_STALE_AFTER_MS,
    )
    .map((p) => ({ id: `player-${p.uid}`, x: p.x, y: p.y, spriteAssetId: 'sprite.player', label: p.displayName }));

  const entities = [...npcEntities, ...buildingEntities, ...shrineEntities, ...otherPlayerEntities];

  return (
    <div className={styles.wrap} style={{ paddingTop: isMobile ? HUD_BAR_HEIGHT.mobile : HUD_BAR_HEIGHT.desktop }}>
      <PlayerHUD locationId={locationId} />
      {pending && <div className={styles.pendingIndicator}>...</div>}
      <div ref={gridWrapperRef} style={{ touchAction: 'none' }}>
        <TileGrid
          map={map}
          tilesetAssetId="tileset.tiny-dungeon"
          tilesetColumns={map.columns}
          player={position}
          playerSpriteAssetId="sprite.player"
          entities={entities}
          scale={scale}
          viewportSize={viewportSize}
        />
      </div>
      {isMobile ? (
        <>
          <DirectionPad attemptMove={attemptMove} />
          <MobileHud
            onInteract={attemptInteract}
            onDash={staminaUnlocked ? dash : undefined}
            onInventory={() => setMenuOpen((open) => !open)}
            onJournal={() => setJournalOpen((open) => !open)}
          />
        </>
      ) : (
        <p className={styles.hint}>
          Move: arrow keys / WASD &nbsp;·&nbsp; Talk: Enter / Space
          {staminaUnlocked && <>&nbsp;·&nbsp; Dash: Shift + direction</>}
          &nbsp;·&nbsp; Inventory: I &nbsp;·&nbsp; Journal: J
        </p>
      )}
      {activeNpc && (
        <DialogueBox
          lines={resolveNpcDialogue(activeNpc, questProgress)}
          portraitAssetId={activeNpc.portraitAssetId}
          onClose={handleDialogueClose}
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
      {shopOpen && <Shop shopId={activeShopId ?? ''} onClose={() => setShopOpen(false)} />}
      {innOpen && <Inn onClose={() => setInnOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
