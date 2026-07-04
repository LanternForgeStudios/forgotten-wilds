import { useEffect, useRef, useState } from 'react';
import { PlayerHUD } from '@/components/PlayerHUD';
import { TileGrid } from '@/components/exploration/TileGrid';
import { MobileHud } from '@/components/exploration/MobileHud';
import { QuestLog } from '@/components/QuestLog';
import { CharacterMenu } from '@/components/CharacterMenu';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useExplorationViewport } from '@/hooks/useExplorationViewport';
import { useDragMovement } from '@/hooks/useDragMovement';
import { useSceneStore } from '@/state/useSceneStore';
import styles from './TownScene.module.css';

const LOCATION_ID = 'ironwood-trail';
const TILESET_COLUMNS = 12;

export function OverworldScene() {
  const goTo = useSceneStore((s) => s.goTo);
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const isMobile = useIsMobile();
  const { scale, viewportTiles } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const suspended = questLogOpen || menuOpen || journalOpen;
  const { map, position, attemptMove } = useLocationExploration({
    locationId: LOCATION_ID,
    suspended,
    onEncounterZoneStep: (chance, pos) => {
      if (Math.random() < chance) {
        goTo('combat', { locationId: LOCATION_ID, spawnX: pos.x, spawnY: pos.y });
      }
    },
  });

  useDragMovement(gridWrapperRef, attemptMove, isMobile && !suspended);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'l' || e.key === 'L') setQuestLogOpen((open) => !open);
      if (e.key === 'i' || e.key === 'I') setMenuOpen((open) => !open);
      if (e.key === 'j' || e.key === 'J') setJournalOpen((open) => !open);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Setting out onto Ironwood Trail...</p>
      </div>
    );
  }

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
          scale={scale}
          viewportTiles={viewportTiles}
        />
      </div>
      {isMobile ? (
        <MobileHud
          onQuestLog={() => setQuestLogOpen((open) => !open)}
          onInventory={() => setMenuOpen((open) => !open)}
          onJournal={() => setJournalOpen((open) => !open)}
        />
      ) : (
        <p className={styles.hint}>
          Move: arrow keys / WASD &nbsp;·&nbsp; Watch for Mothlings in the deep grass &nbsp;·&nbsp; Quest Log: L
          &nbsp;·&nbsp; Inventory: I &nbsp;·&nbsp; Journal: J
        </p>
      )}
      {questLogOpen && <QuestLog onClose={() => setQuestLogOpen(false)} />}
      {menuOpen && <CharacterMenu onClose={() => setMenuOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
