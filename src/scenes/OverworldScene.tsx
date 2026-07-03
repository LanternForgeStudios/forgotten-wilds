import { useEffect, useState } from 'react';
import { PlayerHUD } from '@/components/PlayerHUD';
import { TileGrid } from '@/components/exploration/TileGrid';
import { QuestLog } from '@/components/QuestLog';
import { CharacterMenu } from '@/components/CharacterMenu';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useSceneStore } from '@/state/useSceneStore';
import styles from './TownScene.module.css';

const LOCATION_ID = 'ironwood-trail';
const TILESET_COLUMNS = 12;

export function OverworldScene() {
  const goTo = useSceneStore((s) => s.goTo);
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const { map, position } = useLocationExploration({
    locationId: LOCATION_ID,
    suspended: questLogOpen || menuOpen || journalOpen,
    onEncounterZoneStep: (chance, pos) => {
      if (Math.random() < chance) {
        goTo('combat', { locationId: LOCATION_ID, spawnX: pos.x, spawnY: pos.y });
      }
    },
  });

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
      <TileGrid
        map={map}
        tilesetAssetId="tileset.tiny-dungeon"
        tilesetColumns={TILESET_COLUMNS}
        player={position}
        playerSpriteAssetId="sprite.player"
      />
      <p className={styles.hint}>
        Move: arrow keys / WASD &nbsp;·&nbsp; Watch for Mothlings in the deep grass &nbsp;·&nbsp; Quest Log: L
        &nbsp;·&nbsp; Inventory: I &nbsp;·&nbsp; Journal: J
      </p>
      {questLogOpen && <QuestLog onClose={() => setQuestLogOpen(false)} />}
      {menuOpen && <CharacterMenu onClose={() => setMenuOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
