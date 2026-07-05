import { useEffect, useRef, useState } from 'react';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { MobileHud } from '@/components/exploration/MobileHud';
import { DirectionPad } from '@/components/exploration/DirectionPad';
import { DialogueBox } from '@/components/DialogueBox';
import { PlayerHUD } from '@/components/PlayerHUD';
import { QuestLog } from '@/components/QuestLog';
import { CharacterMenu } from '@/components/CharacterMenu';
import { Shop } from '@/components/Shop';
import { Inn } from '@/components/Inn';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useExplorationViewport, HUD_BAR_HEIGHT } from '@/hooks/useExplorationViewport';
import { useDragMovement } from '@/hooks/useDragMovement';
import { useDash } from '@/hooks/useDash';
import { useDashKeybind } from '@/hooks/useDashKeybind';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useSceneStore } from '@/state/useSceneStore';
import { callTalkToNpc } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { subscribeToPresence } from '@/firebase/presenceService';
import { NPCS } from '@/data';
import type { Npc, OnlinePresence } from '@/types';
import styles from './TownScene.module.css';

const PRESENCE_STALE_AFTER_MS = 60_000;

const TILESET_COLUMNS = 12;

/** Building-door transitions get a facade marker so they read as "a building" rather than a
 *  blank floor tile - keyed by the transition's target locationId (only entrances need this,
 *  not the exit transition back out, which every interior already has). */
const BUILDING_MARKERS: Record<string, { label: string; spriteAssetId: string }> = {
  'ash-hallow-elias-house': { label: "Elias' House", spriteAssetId: 'structure.house' },
  'ash-hallow-mara-shop': { label: "Mara's Shop", spriteAssetId: 'structure.shop' },
  'ash-hallow-inn': { label: 'The Inn', spriteAssetId: 'structure.inn' },
  'ash-hallow-blacksmith': { label: 'The Forge', spriteAssetId: 'structure.blacksmith' },
  'ash-hallow-apothecary': { label: 'Apothecary', spriteAssetId: 'structure.apothecary' },
};

export function TownScene() {
  const locationId = useSceneStore((s) => s.params.locationId) ?? 'ash-hallow';
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [activeShopId, setActiveShopId] = useState<string | undefined>();
  const [innOpen, setInnOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const isMobile = useIsMobile();
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const suspended = activeNpc !== null || questLogOpen || menuOpen || shopOpen || innOpen || journalOpen;
  const { map, position, positionRef, facingDelta, attemptMove, wanderPositions } = useLocationExploration({
    locationId,
    suspended,
  });
  const [presences, setPresences] = useState<OnlinePresence[]>([]);

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
        callTalkToNpc(npc.id)
          .then(async () => {
            if (uid) await resyncSave(uid);
          })
          .catch((err) => console.error('talkToNpc failed', err));
      }
    }
  }

  useEffect(() => {
    function handleInteract(e: KeyboardEvent) {
      if (e.key === 'l' || e.key === 'L') {
        setQuestLogOpen((open) => !open);
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
  }, [activeNpc, questLogOpen, menuOpen, shopOpen, innOpen, journalOpen, map, position, facingDelta, uid, wanderPositions]);

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

  const now = Date.now();
  const otherPlayerEntities: GridEntity[] = presences
    .filter(
      (p) =>
        p.uid !== uid && p.locationId === locationId && now - p.lastHeartbeat < PRESENCE_STALE_AFTER_MS,
    )
    .map((p) => ({ id: `player-${p.uid}`, x: p.x, y: p.y, spriteAssetId: 'sprite.player', label: p.displayName }));

  const entities = [...npcEntities, ...buildingEntities, ...otherPlayerEntities];

  return (
    <div className={styles.wrap} style={{ paddingTop: isMobile ? HUD_BAR_HEIGHT.mobile : HUD_BAR_HEIGHT.desktop }}>
      <PlayerHUD locationId={locationId} />
      <div ref={gridWrapperRef} style={{ touchAction: 'none' }}>
        <TileGrid
          map={map}
          tilesetAssetId="tileset.tiny-dungeon"
          tilesetColumns={TILESET_COLUMNS}
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
            onQuestLog={() => setQuestLogOpen((open) => !open)}
            onInventory={() => setMenuOpen((open) => !open)}
            onJournal={() => setJournalOpen((open) => !open)}
          />
        </>
      ) : (
        <p className={styles.hint}>
          Move: arrow keys / WASD &nbsp;·&nbsp; Talk: Enter / Space
          {staminaUnlocked && <>&nbsp;·&nbsp; Dash: Shift + direction</>}
          &nbsp;·&nbsp; Quest Log: L &nbsp;·&nbsp; Inventory: I &nbsp;·&nbsp; Journal: J
        </p>
      )}
      {activeNpc && (
        <DialogueBox
          lines={activeNpc.dialogue}
          portraitAssetId={activeNpc.portraitAssetId}
          onClose={handleDialogueClose}
        />
      )}
      {questLogOpen && <QuestLog onClose={() => setQuestLogOpen(false)} />}
      {menuOpen && <CharacterMenu onClose={() => setMenuOpen(false)} />}
      {shopOpen && <Shop shopId={activeShopId ?? ''} onClose={() => setShopOpen(false)} />}
      {innOpen && <Inn onClose={() => setInnOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
