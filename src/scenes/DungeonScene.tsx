import { useEffect, useRef, useState } from 'react';
import { PlayerHUD } from '@/components/PlayerHUD';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { MobileHud } from '@/components/exploration/MobileHud';
import { Panel } from '@/components/common/Panel';
import { QuestLog } from '@/components/QuestLog';
import { CharacterMenu } from '@/components/CharacterMenu';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useExplorationViewport } from '@/hooks/useExplorationViewport';
import { useDragMovement } from '@/hooks/useDragMovement';
import { useSceneStore } from '@/state/useSceneStore';
import { useAuthStore } from '@/state/useAuthStore';
import { useQuestStore } from '@/state/useQuestStore';
import { callCollectWorldItem } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import styles from './TownScene.module.css';

const LOCATION_ID = 'hollow-rail-mine';
const TILESET_COLUMNS = 12;

export function DungeonScene() {
  const goTo = useSceneStore((s) => s.goTo);
  const uid = useAuthStore((s) => s.user?.uid);
  const questProgress = useQuestStore((s) => s.progress);
  const [message, setMessage] = useState<string | null>(null);
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const isMobile = useIsMobile();
  const { scale, viewportTiles } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const suspended = message !== null || questLogOpen || menuOpen || journalOpen;
  const { map, position, facingDelta, attemptMove } = useLocationExploration({
    locationId: LOCATION_ID,
    suspended,
    onEncounterZoneStep: (chance, pos) => {
      if (Math.random() < chance) {
        goTo('combat', { locationId: LOCATION_ID, spawnX: pos.x, spawnY: pos.y });
      }
    },
  });

  useDragMovement(gridWrapperRef, attemptMove, isMobile && !suspended);

  function attemptInteract() {
    if (suspended || !map) return;
    const { dx, dy } = facingDelta(position.facing);
    const target = { x: position.x + dx, y: position.y + dy };
    const obj = map.objects.find(
      (o) => o.type === 'interactable' && o.x === target.x && o.y === target.y,
    );
    if (obj?.refId === 'miners-lost-lantern') {
      callCollectWorldItem(LOCATION_ID, 'miners-lost-lantern')
        .then(async (res) => {
          if (uid) await resyncSave(uid);
          setMessage(
            res.alreadyCollected
              ? "There's nothing left here — you already recovered the lantern."
              : "You pry the battered lantern free of the rubble. It's warm to the touch, as if never truly abandoned.",
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The lantern will not budge.'));
    } else if (obj?.refId === 'coalbound-warden') {
      const ready = questProgress['the-miners-lantern']?.status === 'completed';
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
    }
  }

  useEffect(() => {
    function handleInteract(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (message) setMessage(null);
        else if (questLogOpen) setQuestLogOpen(false);
        else if (menuOpen) setMenuOpen(false);
        else if (journalOpen) setJournalOpen(false);
        return;
      }
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
  }, [message, questLogOpen, menuOpen, journalOpen, map, position, facingDelta, uid, questProgress, goTo]);

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Descending into Hollow Rail Mine...</p>
      </div>
    );
  }

  const entities: GridEntity[] = map.objects
    .filter((o) => o.type === 'interactable')
    .map((o) => {
      if (o.refId === 'coalbound-warden') {
        return { id: o.refId, x: o.x, y: o.y, spriteAssetId: 'battle.enemy.coalbound-warden', label: '???' };
      }
      return {
        id: o.refId ?? `${o.x},${o.y}`,
        x: o.x,
        y: o.y,
        spriteAssetId: 'icon.item.miners-lost-lantern',
        label: 'Lantern Relic',
      };
    });

  return (
    <div className={styles.wrap}>
      <PlayerHUD />
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
          Move: arrow keys / WASD &nbsp;·&nbsp; Interact: Enter / Space &nbsp;·&nbsp; Quest Log: L &nbsp;·&nbsp; Inventory: I
          &nbsp;·&nbsp; Journal: J
        </p>
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
      {questLogOpen && <QuestLog onClose={() => setQuestLogOpen(false)} />}
      {menuOpen && <CharacterMenu onClose={() => setMenuOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
