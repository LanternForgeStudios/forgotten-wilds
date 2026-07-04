import { useEffect, useRef, useState } from 'react';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { MobileHud } from '@/components/exploration/MobileHud';
import { DialogueBox } from '@/components/DialogueBox';
import { PlayerHUD } from '@/components/PlayerHUD';
import { QuestLog } from '@/components/QuestLog';
import { CharacterMenu } from '@/components/CharacterMenu';
import { Shop } from '@/components/Shop';
import { Inn } from '@/components/Inn';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { TownPresencePanel } from '@/components/TownPresencePanel';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useExplorationViewport } from '@/hooks/useExplorationViewport';
import { useDragMovement } from '@/hooks/useDragMovement';
import { useWanderingNpcs } from '@/hooks/useWanderingNpcs';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useSceneStore } from '@/state/useSceneStore';
import { callTalkToNpc } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { NPCS } from '@/data';
import type { Npc } from '@/types';
import styles from './TownScene.module.css';

const TILESET_COLUMNS = 12;

/** Building-door transitions get a facade marker so they read as "a building" rather than a
 *  blank floor tile - keyed by the transition's target locationId (only entrances need this,
 *  not the exit transition back out, which every interior already has). */
const BUILDING_MARKERS: Record<string, { label: string; spriteAssetId: string }> = {
  'ash-hallow-elias-house': { label: "Elias' House", spriteAssetId: 'structure.house' },
  'ash-hallow-mara-shop': { label: "Mara's Shop", spriteAssetId: 'structure.shop' },
  'ash-hallow-inn': { label: 'The Inn', spriteAssetId: 'structure.inn' },
};

export function TownScene() {
  const locationId = useSceneStore((s) => s.params.locationId) ?? 'ash-hallow';
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [innOpen, setInnOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const isMobile = useIsMobile();
  const { scale, viewportTiles } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const suspended = activeNpc !== null || questLogOpen || menuOpen || shopOpen || innOpen || journalOpen;
  const { map, position, facingDelta, attemptMove } = useLocationExploration({
    locationId,
    suspended,
  });

  const wanderPositions = useWanderingNpcs(map);

  useHeartbeat(uid, displayName, locationId);
  useDragMovement(gridWrapperRef, attemptMove, isMobile && !suspended);

  function handleDialogueClose() {
    const hook = activeNpc?.gameplayHook;
    setActiveNpc(null);
    if (hook?.type === 'shop') setShopOpen(true);
    else if (hook?.type === 'inn') setInnOpen(true);
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

  const entities = [...npcEntities, ...buildingEntities];

  return (
    <div className={styles.wrap}>
      <PlayerHUD />
      <TownPresencePanel locationId={locationId} />
      <div ref={gridWrapperRef} style={{ touchAction: 'none' }}>
        <TileGrid
          map={map}
          tilesetAssetId="tileset.tiny-dungeon"
          tilesetColumns={TILESET_COLUMNS}
          player={position}
          playerSpriteAssetId="sprite.player"
          entities={entities}
          scale={scale}
          viewportTiles={viewportTiles}
        />
      </div>
      {isMobile ? (
        <MobileHud
          onInteract={attemptInteract}
          onQuestLog={() => setQuestLogOpen((open) => !open)}
          onInventory={() => setMenuOpen((open) => !open)}
          onJournal={() => setJournalOpen((open) => !open)}
        />
      ) : (
        <p className={styles.hint}>
          Move: arrow keys / WASD &nbsp;·&nbsp; Talk: Enter / Space &nbsp;·&nbsp; Quest Log: L &nbsp;·&nbsp; Inventory: I
          &nbsp;·&nbsp; Journal: J
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
      {shopOpen && <Shop onClose={() => setShopOpen(false)} />}
      {innOpen && <Inn onClose={() => setInnOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
